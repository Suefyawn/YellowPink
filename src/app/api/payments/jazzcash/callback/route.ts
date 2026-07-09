// ============================================================================
// POST /api/payments/jazzcash/callback, JazzCash POSTs here after the user
// finishes (or aborts) payment. We verify the signature, update the matching
// payment row, advance the order status, and bounce the user to the
// thank-you or checkout-failed page.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyJazzCashCallback } from '@/lib/payments/jazzcash';
import { sendOrderConfirmationEmail, sendPaymentReceivedEmail } from '@/lib/email';
import { sendMetaPurchaseEvent } from '@/lib/meta-capi';
import { SITE_URL } from '@/lib/seo';
import { log } from '@/lib/logger';
import type { CartItem } from '@/types';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const raw: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === 'string') raw[k] = v;
  }

  let verification;
  try {
    verification = verifyJazzCashCallback(raw);
  } catch (err) {
    // Misconfiguration (missing/blank salt) bounces EVERY paying customer,
    // so it must page the owner, not fail silently into a redirect.
    log.error('payments.jazzcash.config_error', { err, txn_ref: raw.pp_TxnRefNo });
    return NextResponse.redirect(new URL('/checkout?error=payment_config', req.url), 303);
  }

  // Refuse any callback with a bad signature BEFORE we touch the database.
  // Otherwise an attacker who guesses a (predictable) txn_ref can pollute the
  // existing payments row's status / raw_payload / error_message with
  // attacker-supplied data, even though the order itself is protected
  // downstream by the amount + status guards.
  if (!verification.ok) {
    // A wrong live-vs-sandbox salt fails verification on 100% of real
    // payments and, unlogged, masquerades as customers abandoning checkout.
    log.error('payments.jazzcash.signature_failed', { txn_ref: verification.txnRef });
    return NextResponse.redirect(new URL(`/checkout?error=signature`, req.url), 303);
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  // Idempotency: update the previously-inserted "initiated" payment row.
  const { error: ledgerErr } = await sb.from('payments').update({
    status: verification.status,
    raw_payload: raw,
    error_message: verification.status === 'failed' ? verification.responseMessage : null,
  }).eq('gateway', 'jazzcash').eq('txn_ref', verification.txnRef);
  if (ledgerErr) {
    // Reconciliation row failed to record — don't block the customer flow,
    // but the owner must know the payments ledger is missing an entry.
    log.error('payments.jazzcash.ledger_update_failed', { err: ledgerErr, txn_ref: verification.txnRef });
  }

  const { data: order } = await sb
    .from('orders')
    .select('id, email, phone, first_name, total, items, order_number, status')
    .eq('order_number', verification.orderNumber)
    .single();

  if (!order) {
    return NextResponse.redirect(new URL('/checkout?error=order_missing', req.url), 303);
  }

  // P0-3: assert the gateway charged exactly what the order expects. Without
  // this, a tampered cart that submitted a low total (caught by place_order
  // since the 065 migration but worth defending in depth) or a replayed
  // callback from a partially-paid order would mark the wrong order as paid.
  // Compare in paisa to dodge float drift.
  const orderPaisa = Math.round(Number(order.total) * 100);
  const gatewayPaisa = Math.round(verification.amountPkr * 100);
  if (orderPaisa !== gatewayPaisa) {
    // The customer may have actually been charged here — this must reach the
    // owner immediately, not sit silently in payment_pending until the
    // stuck-payments digest frames it as abandonment.
    log.error('payments.jazzcash.amount_mismatch', {
      order_number: order.order_number, order_paisa: orderPaisa, gateway_paisa: gatewayPaisa,
      txn_ref: verification.txnRef,
    });
    await sb.from('payments').update({
      status: 'failed',
      error_message: `amount mismatch: order=${orderPaisa}p, gateway=${gatewayPaisa}p`,
    }).eq('gateway', 'jazzcash').eq('txn_ref', verification.txnRef);
    return NextResponse.redirect(new URL(`/checkout?error=payment_failed&order=${encodeURIComponent(order.order_number)}`, req.url), 303);
  }

  if (verification.status === 'succeeded') {
    // P0-4: idempotent state transition. A replayed callback (or one arriving
    // after a refund/cancel) must not flip a non-payment_pending order back
    // to pending. The WHERE clause is the lock — and `.select('id')` makes the
    // row count observable, so a FAILED write can no longer masquerade as a
    // successful transition (previously the customer got "confirmed" emails
    // and Meta got a Purchase while the order stayed stuck in
    // payment_pending).
    const { data: flipped, error: flipErr } = await sb.from('orders')
      .update({ status: 'pending' })
      .eq('id', order.id)
      .eq('status', 'payment_pending')
      .select('id');
    if (flipErr) {
      log.error('payments.jazzcash.order_update_failed', {
        err: flipErr, order_number: order.order_number, txn_ref: verification.txnRef,
      });
    }

    // Emails + CAPI fire only when THIS request actually performed the
    // transition (exactly-once even under replays, and never on a failed
    // write). The customer still lands on thank-you either way — their
    // payment DID succeed; a stuck order is the owner's problem to fix, not
    // a reason to scare a paid customer back into checkout.
    const firstTransition = !flipErr && (flipped?.length ?? 0) > 0;

    if (firstTransition && order.email) {
      const items = (order.items as CartItem[]) ?? [];
      await Promise.all([
        sendPaymentReceivedEmail({
          email: order.email,
          first_name: order.first_name ?? 'there',
          order_number: order.order_number,
          total: order.total,
          method: 'JazzCash',
        }),
        sendOrderConfirmationEmail({
          email: order.email,
          first_name: order.first_name ?? 'there',
          last_name: '',
          phone: '',
          city: '',
          order_number: order.order_number,
          total: order.total,
          items: items.map(i => ({ name: i.name, brand: i.brand ?? undefined, variant: i.variant_label ?? i.variant, qty: i.qty, price: i.price })),
          pay_method: 'jazzcash',
        }),
      ]);
    }

    // Server-side Meta Purchase (CAPI). Paid orders never fire the client
    // Pixel purchase (the shopper is on the gateway), so this is the only
    // conversion signal for them. First transition only, to avoid duplicates.
    if (firstTransition) {
      const paidItems = (order.items as CartItem[]) ?? [];
      await sendMetaPurchaseEvent({
        orderNumber: order.order_number,
        value: Number(order.total),
        currency: 'PKR',
        email: order.email,
        phone: (order as { phone?: string | null }).phone ?? null,
        numItems: paidItems.reduce((s, i) => s + (i.qty ?? 0), 0),
        eventSourceUrl: `${SITE_URL}/thank-you`,
        // The shopper is redirected back here in their browser, so the Pixel
        // cookies + IP/UA are present, pass them for CAPI match quality.
        fbc: req.cookies.get('_fbc')?.value,
        fbp: req.cookies.get('_fbp')?.value,
        clientIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
        userAgent: req.headers.get('user-agent') ?? undefined,
      });
    }
    return NextResponse.redirect(new URL(`/thank-you?order=${encodeURIComponent(order.order_number)}`, req.url), 303);
  }

  // P0-4: only flip to payment_failed if we were still waiting. Don't
  // resurrect a fulfilled order from a late failure callback.
  const { error: failErr } = await sb.from('orders').update({ status: 'payment_failed' })
    .eq('id', order.id)
    .eq('status', 'payment_pending');
  if (failErr) {
    log.error('payments.jazzcash.order_update_failed', {
      err: failErr, order_number: order.order_number, txn_ref: verification.txnRef,
    });
  }
  return NextResponse.redirect(new URL(`/checkout?error=payment_failed&order=${encodeURIComponent(order.order_number)}`, req.url), 303);
}

// JazzCash may also send a GET on certain failure flows.
export const GET = POST;
