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
    .select('id, email, first_name, total, items, order_number')
    .eq('order_number', verification.orderNumber)
    .single();

  if (!order) {
    return NextResponse.redirect(new URL('/checkout?error=order_missing', req.url), 303);
  }

  if (verification.status === 'succeeded') {
    await sb.from('orders').update({ status: 'pending' }).eq('id', order.id);

    if (order.email) {
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

  await sb.from('orders').update({ status: 'payment_failed' }).eq('id', order.id);
  return NextResponse.redirect(new URL(`/checkout?error=payment_failed&order=${encodeURIComponent(order.order_number)}`, req.url), 303);
}

// JazzCash may also send a GET on certain failure flows.
export const GET = POST;
