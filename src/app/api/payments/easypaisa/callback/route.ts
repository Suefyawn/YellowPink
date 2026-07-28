// ============================================================================
// POST /api/payments/easypaisa/callback, verify Easypaisa response, update
// payment + order, bounce the user to /thank-you or back to /checkout.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { verifyEasypaisaCallback } from '@/lib/payments/easypaisa';
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
    verification = verifyEasypaisaCallback(raw);
  } catch (err) {
    // Misconfiguration (missing/blank credentials) bounces EVERY paying
    // customer, so it must page the owner, not fail silently into a redirect.
    log.error('payments.easypaisa.config_error', { err });
    return NextResponse.redirect(new URL('/checkout?error=payment_config', req.url), 303);
  }

  // Refuse any callback with a bad signature BEFORE we touch the database.
  // The order_number rides in the redirect URL and is therefore easy for an
  // attacker to discover; without this early-return a forged callback would
  // still pollute the matching payments row's status / raw_payload.
  if (!verification.ok) {
    // A wrong live-vs-sandbox credential fails verification on 100% of real
    // payments and, unlogged, masquerades as customers abandoning checkout.
    log.error('payments.easypaisa.signature_failed', { order_number: verification.orderNumber });
    return NextResponse.redirect(new URL(`/checkout?error=signature`, req.url), 303);
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: order } = await sb
    .from('orders')
    .select('id, email, phone, first_name, total, items, order_number, status')
    .eq('order_number', verification.orderNumber)
    .single();

  if (!order) {
    return NextResponse.redirect(new URL('/checkout?error=order_missing', req.url), 303);
  }

  const { error: ledgerErr } = await sb.from('payments').update({
    status: verification.status,
    raw_payload: raw,
    error_message: verification.status === 'failed' ? verification.responseMessage : null,
  }).eq('gateway', 'easypaisa').eq('order_id', order.id);
  if (ledgerErr) {
    // Reconciliation row failed to record — don't block the customer flow,
    // but the owner must know the payments ledger is missing an entry.
    log.error('payments.easypaisa.ledger_update_failed', { err: ledgerErr, order_number: order.order_number });
  }

  // P0-3: amount-tamper defence, gateway must report what we billed.
  const orderPaisa = Math.round(Number(order.total) * 100);
  const gatewayPaisa = Math.round(verification.amountPkr * 100);
  if (orderPaisa !== gatewayPaisa) {
    // The customer may have actually been charged here — this must reach the
    // owner immediately, not sit silently in payment_pending until the
    // stuck-payments digest frames it as abandonment.
    log.error('payments.easypaisa.amount_mismatch', {
      order_number: order.order_number, order_paisa: orderPaisa, gateway_paisa: gatewayPaisa,
    });
    await sb.from('payments').update({
      status: 'failed',
      error_message: `amount mismatch: order=${orderPaisa}p, gateway=${gatewayPaisa}p`,
    }).eq('gateway', 'easypaisa').eq('order_id', order.id);
    return NextResponse.redirect(new URL(`/checkout?error=payment_failed&order=${encodeURIComponent(order.order_number)}`, req.url), 303);
  }

  if (verification.status === 'succeeded') {
    // P0-4: idempotent transition, only flip if still waiting. `.select('id')`
    // makes the row count observable, so a FAILED write can no longer
    // masquerade as a successful transition (previously the customer got
    // "confirmed" emails and Meta got a Purchase while the order stayed
    // stuck in payment_pending).
    const { data: flipped, error: flipErr } = await sb.from('orders')
      .update({ status: 'pending' })
      .eq('id', order.id)
      .eq('status', 'payment_pending')
      .select('id');
    if (flipErr) {
      log.error('payments.easypaisa.order_update_failed', { err: flipErr, order_number: order.order_number });
    }
    // Emails + CAPI only when THIS request actually performed the transition
    // (exactly-once under replays, never on a failed write). The customer
    // still lands on thank-you — their payment DID succeed.
    const firstTransition = !flipErr && (flipped?.length ?? 0) > 0;
    if (firstTransition && order.email) {
      const items = (order.items as CartItem[]) ?? [];
      await Promise.all([
        sendPaymentReceivedEmail({
          email: order.email,
          first_name: order.first_name ?? 'there',
          order_number: order.order_number,
          total: order.total,
          method: 'Easypaisa',
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
          pay_method: 'easypaisa',
        }),
      ]);
    }

    // Server-side Meta Purchase (CAPI), the only conversion signal for paid
    // orders, which never fire the client Pixel. First transition only.
    if (firstTransition) {
      const paidItems = (order.items as CartItem[]) ?? [];
      // Stock for these items was decremented at order creation; make sure
      // their PDPs reflect it (the ISR window is an hour, busts are explicit).
      for (const slug of new Set(paidItems.map(i => i.slug).filter(Boolean))) {
        revalidatePath(`/product/${slug}`);
      }
      await sendMetaPurchaseEvent({
        orderNumber: order.order_number,
        value: Number(order.total),
        currency: 'PKR',
        email: order.email,
        phone: (order as { phone?: string | null }).phone ?? null,
        // Slugs match the Meta catalogue feed's g:id for catalogue attribution.
        contentIds: paidItems.map(i => i.slug).filter((s): s is string => Boolean(s)),
        numItems: paidItems.reduce((s, i) => s + (i.qty ?? 0), 0),
        eventSourceUrl: `${SITE_URL}/thank-you`,
        // Browser redirect back from the gateway carries the Pixel cookies +
        // IP/UA, pass them for CAPI match quality.
        fbc: req.cookies.get('_fbc')?.value,
        fbp: req.cookies.get('_fbp')?.value,
        clientIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
        userAgent: req.headers.get('user-agent') ?? undefined,
      });
    }
    return NextResponse.redirect(new URL(`/thank-you?order=${encodeURIComponent(order.order_number)}`, req.url), 303);
  }

  // P0-4: idempotent failure transition.
  const { error: failErr } = await sb.from('orders').update({ status: 'payment_failed' })
    .eq('id', order.id)
    .eq('status', 'payment_pending');
  if (failErr) {
    log.error('payments.easypaisa.order_update_failed', { err: failErr, order_number: order.order_number });
  }
  return NextResponse.redirect(new URL(`/checkout?error=payment_failed&order=${encodeURIComponent(order.order_number)}`, req.url), 303);
}

export const GET = POST;
