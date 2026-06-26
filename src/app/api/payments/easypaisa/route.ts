// ============================================================================
// POST /api/payments/easypaisa, analog of the JazzCash initiator for the
// Easypaisa hosted checkout. See route.ts for JazzCash for shape.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { initiateEasypaisaCheckout } from '@/lib/payments/easypaisa';
import { checkoutLimiter, ipFromHeaders } from '@/lib/ratelimit';

function escape(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  );
}

export async function POST(req: NextRequest) {
  const { success } = await checkoutLimiter.limit(ipFromHeaders(req.headers));
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const form = await req.formData();
  const orderNumber = form.get('order_number');
  if (typeof orderNumber !== 'string' || !orderNumber) {
    return NextResponse.json({ error: 'order_number is required' }, { status: 400 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: order } = await sb
    .from('orders')
    .select('id, order_number, total, status, pay_method')
    .eq('order_number', orderNumber)
    .single();

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'payment_pending') {
    return NextResponse.json({ error: `Order is not awaiting payment (status: ${order.status})` }, { status: 409 });
  }
  if (order.pay_method !== 'easypaisa') {
    return NextResponse.json({ error: `Order is not an Easypaisa order (method: ${order.pay_method})` }, { status: 409 });
  }

  let initiate;
  try {
    initiate = initiateEasypaisaCheckout({
      amountPkr: order.total,
      orderNumber: order.order_number,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gateway not configured';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  await sb.from('payments').insert({
    order_id: order.id,
    gateway: 'easypaisa',
    amount: order.total,
    status: 'initiated',
    txn_ref: initiate.txnRef,
  });

  const inputs = Object.entries(initiate.fields)
    .map(([k, v]) => `<input type="hidden" name="${escape(k)}" value="${escape(String(v))}"/>`)
    .join('');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Redirecting to Easypaisa…</title></head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:64px 16px;color:#374151">
  <p>Redirecting you to Easypaisa to complete payment for order <strong>${escape(order.order_number)}</strong>…</p>
  <form id="f" method="POST" action="${escape(initiate.endpoint)}">${inputs}</form>
  <script>document.getElementById('f').submit();</script>
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
