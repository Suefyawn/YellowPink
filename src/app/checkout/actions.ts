'use server';

import { headers } from 'next/headers';
import {
  sendNewOrderEmail,
  sendOrderConfirmationEmail,
} from '@/lib/email';
import { checkoutLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { resolveShipping } from '@/lib/shipping';
import { sendMetaPurchaseEvent } from '@/lib/meta-capi';
import { SITE_URL } from '@/lib/seo';

// ─── Order notifications fan-out (called after a successful place_order RPC) ─
// Sends the internal new-order email and (if we have a customer email)
// the customer confirmation. Best-effort: errors are swallowed inside email.
//
// Called from CheckoutPage.tsx after the place_order RPC succeeds for the
// COD path. JazzCash/Easypaisa email fan-out happens inside the gateway
// callback route handlers instead.
export async function notifyNewOrder(order: {
  order_number: string;
  email?: string;
  first_name: string;
  last_name: string;
  phone: string;
  city: string;
  province?: string;
  total: number;
  items: Array<{ name: string; qty: number; price: number; brand?: string; variant?: string }>;
  pay_method: string;
}): Promise<void> {
  const sends: Promise<void>[] = [sendNewOrderEmail(order)];
  if (order.email) {
    sends.push(
      sendOrderConfirmationEmail({
        email: order.email,
        first_name: order.first_name,
        last_name: order.last_name,
        phone: order.phone,
        city: order.city,
        province: order.province,
        order_number: order.order_number,
        total: order.total,
        items: order.items,
        pay_method: order.pay_method,
      })
    );
  }
  await Promise.all(sends);

  // Server-side Meta Conversions API Purchase (deduped with the client Pixel
  // via event_id = order number). Best-effort; no-op unless CAPI is configured.
  await sendMetaPurchaseEvent({
    orderNumber: order.order_number,
    value: order.total,
    currency: 'PKR',
    email: order.email,
    phone: order.phone,
    numItems: order.items.reduce((s, i) => s + (i.qty ?? 0), 0),
    eventSourceUrl: `${SITE_URL}/thank-you`,
  });
}

// ─── Shipping calculator exposed to the client for the order summary. ──────
export async function calculateShipping(opts: {
  province?: string;
  subtotal: number;
}): Promise<{ rate: number; free: boolean; label: string }> {
  const resolved = await resolveShipping(opts);
  return { rate: resolved.rate, free: resolved.free, label: resolved.label };
}

// ─── Server-side rate-limit gate (called before place_order client RPC). ────
export async function checkoutRateGate(): Promise<{ ok: boolean }> {
  const h = await headers();
  const { success } = await checkoutLimiter.limit(ipFromHeaders(h));
  return { ok: success };
}

// Note: postOrderDestination is a pure helper and lives in @/lib/checkout-routing
// so it can be imported by client code without being treated as a server action.
