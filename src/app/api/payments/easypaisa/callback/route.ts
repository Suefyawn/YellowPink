// ============================================================================
// POST /api/payments/easypaisa/callback — verify Easypaisa response, update
// payment + order, bounce the user to /thank-you or back to /checkout.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyEasypaisaCallback } from '@/lib/payments/easypaisa';
import { sendOrderConfirmationEmail, sendPaymentReceivedEmail } from '@/lib/email';
import { sendMetaPurchaseEvent } from '@/lib/meta-capi';
import { SITE_URL } from '@/lib/seo';
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
  } catch {
    return NextResponse.redirect(new URL('/checkout?error=payment_config', req.url), 303);
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

  await sb.from('payments').update({
    status: verification.status,
    raw_payload: raw,
    error_message: verification.status === 'failed' ? verification.responseMessage : null,
  }).eq('gateway', 'easypaisa').eq('order_id', order.id);

  if (!verification.ok) {
    return NextResponse.redirect(new URL(`/checkout?error=signature`, req.url), 303);
  }

  // P0-3: amount-tamper defence — gateway must report what we billed.
  const orderPaisa = Math.round(Number(order.total) * 100);
  const gatewayPaisa = Math.round(verification.amountPkr * 100);
  if (orderPaisa !== gatewayPaisa) {
    await sb.from('payments').update({
      status: 'failed',
      error_message: `amount mismatch: order=${orderPaisa}p, gateway=${gatewayPaisa}p`,
    }).eq('gateway', 'easypaisa').eq('order_id', order.id);
    return NextResponse.redirect(new URL(`/checkout?error=payment_failed&order=${encodeURIComponent(order.order_number)}`, req.url), 303);
  }

  if (verification.status === 'succeeded') {
    // P0-4: idempotent transition — only flip if still waiting.
    await sb.from('orders').update({ status: 'pending' })
      .eq('id', order.id)
      .eq('status', 'payment_pending');
    const firstTransition = order.status === 'payment_pending';
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
          items: items.map(i => ({ name: i.name, brand: i.brand ?? undefined, variant: i.variant, qty: i.qty, price: i.price })),
          pay_method: 'easypaisa',
        }),
      ]);
    }

    // Server-side Meta Purchase (CAPI) — the only conversion signal for paid
    // orders, which never fire the client Pixel. First transition only.
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
      });
    }
    return NextResponse.redirect(new URL(`/thank-you?order=${encodeURIComponent(order.order_number)}`, req.url), 303);
  }

  // P0-4: idempotent failure transition.
  await sb.from('orders').update({ status: 'payment_failed' })
    .eq('id', order.id)
    .eq('status', 'payment_pending');
  return NextResponse.redirect(new URL(`/checkout?error=payment_failed&order=${encodeURIComponent(order.order_number)}`, req.url), 303);
}

export const GET = POST;
