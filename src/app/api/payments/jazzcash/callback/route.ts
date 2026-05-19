// ============================================================================
// POST /api/payments/jazzcash/callback — JazzCash POSTs here after the user
// finishes (or aborts) payment. We verify the signature, update the matching
// payment row, advance the order status, and bounce the user to the
// thank-you or checkout-failed page.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyJazzCashCallback } from '@/lib/payments/jazzcash';
import { sendOrderConfirmationEmail, sendPaymentReceivedEmail } from '@/lib/email';
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
  } catch {
    return NextResponse.redirect(new URL('/checkout?error=payment_config', req.url), 303);
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  // Idempotency: update the previously-inserted "initiated" payment row.
  await sb.from('payments').update({
    status: verification.status,
    raw_payload: raw,
    error_message: verification.status === 'failed' ? verification.responseMessage : null,
  }).eq('gateway', 'jazzcash').eq('txn_ref', verification.txnRef);

  if (!verification.ok) {
    return NextResponse.redirect(new URL(`/checkout?error=signature`, req.url), 303);
  }

  const { data: order } = await sb
    .from('orders')
    .select('id, email, first_name, total, items, order_number, status')
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
    await sb.from('payments').update({
      status: 'failed',
      error_message: `amount mismatch: order=${orderPaisa}p, gateway=${gatewayPaisa}p`,
    }).eq('gateway', 'jazzcash').eq('txn_ref', verification.txnRef);
    return NextResponse.redirect(new URL(`/checkout?error=payment_failed&order=${encodeURIComponent(order.order_number)}`, req.url), 303);
  }

  if (verification.status === 'succeeded') {
    // P0-4: idempotent state transition. A replayed callback (or one arriving
    // after a refund/cancel) must not flip a non-payment_pending order back
    // to pending. The WHERE clause is the lock.
    await sb.from('orders').update({ status: 'pending' })
      .eq('id', order.id)
      .eq('status', 'payment_pending');

    // If the order already moved past payment_pending (success replay), the
    // UPDATE was a no-op — still redirect to thank-you so the user lands
    // somewhere sensible. Only send confirmation emails on the FIRST
    // transition (status was still payment_pending when we loaded it).
    const firstTransition = order.status === 'payment_pending';

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
          items: items.map(i => ({ name: i.name, brand: i.brand, variant: i.variant, qty: i.qty, price: i.price })),
          pay_method: 'jazzcash',
        }),
      ]);
    }
    return NextResponse.redirect(new URL(`/thank-you?order=${encodeURIComponent(order.order_number)}`, req.url), 303);
  }

  // P0-4: only flip to payment_failed if we were still waiting. Don't
  // resurrect a fulfilled order from a late failure callback.
  await sb.from('orders').update({ status: 'payment_failed' })
    .eq('id', order.id)
    .eq('status', 'payment_pending');
  return NextResponse.redirect(new URL(`/checkout?error=payment_failed&order=${encodeURIComponent(order.order_number)}`, req.url), 303);
}

// JazzCash may also send a GET on certain failure flows.
export const GET = POST;
