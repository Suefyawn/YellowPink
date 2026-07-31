'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  sendNewOrderEmail,
  sendOrderConfirmationEmail,
} from '@/lib/email';
import { checkoutLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { resolveShipping } from '@/lib/shipping';
import { supabase } from '@/lib/supabase';
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
  items: Array<{ name: string; qty: number; price: number; brand?: string; variant?: string; slug?: string }>;
  pay_method: string;
}): Promise<void> {
  // The place_order RPC just decremented stock for these items; bust their
  // PDPs so a sell-out shows immediately. This is what lets the PDP ISR
  // window be a full hour instead of 5 minutes (admin edits already
  // revalidate explicitly) — see /product/[slug]/page.tsx.
  for (const slug of new Set(order.items.map(i => i.slug).filter(Boolean))) {
    revalidatePath(`/product/${slug}`);
  }

  // sendOrderConfirmationEmail resolves to a boolean (did the provider accept
  // it?); it's fire-and-forget here, so the widened element type is fine.
  const sends: Promise<void | boolean>[] = [sendNewOrderEmail(order)];
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
  // Read the Meta Pixel cookies + request IP/UA so the CAPI event matches the
  // browser Pixel for accurate attribution (server action → request scope).
  const ck = await cookies();
  const hdrs = await headers();
  await sendMetaPurchaseEvent({
    orderNumber: order.order_number,
    value: order.total,
    currency: 'PKR',
    email: order.email,
    phone: order.phone,
    // Slugs, not UUIDs: the Meta catalogue feed's item ids are product slugs,
    // and content_ids only helps attribution when it matches the catalogue.
    contentIds: order.items.map(i => i.slug).filter((s): s is string => Boolean(s)),
    numItems: order.items.reduce((s, i) => s + (i.qty ?? 0), 0),
    eventSourceUrl: `${SITE_URL}/thank-you`,
    fbc: ck.get('_fbc')?.value,
    fbp: ck.get('_fbp')?.value,
    clientIp: ipFromHeaders(hdrs),
    userAgent: hdrs.get('user-agent') ?? undefined,
  });
}

// ─── Shipping calculator exposed to the client for the order summary. ──────
export async function calculateShipping(opts: {
  province?: string;
  subtotal: number;
  /** Cart lines — enables the vendor free-shipping rule (NB Sons items
   *  ≥ Rs 1,999 ship free, matching nbsons.com). `id` is the product id;
   *  vendor_id is re-resolved server-side from it, so carts whose lines
   *  predate the vendor_id column (old localStorage snapshots, tile adds
   *  from before the column shipped) still qualify. */
  items?: Array<{ id?: string; vendor_id?: string | null; price: number; qty: number }>;
}): Promise<{ rate: number; free: boolean; label: string }> {
  // Re-derive the amounts server-side shape only (price×qty); place_order
  // recomputes everything from the products table at submit, so a tampered
  // quote can only mislead the tamperer's own order summary.
  const items = (opts.items ?? []).map(i => ({
    id: typeof i.id === 'string' ? i.id : undefined,
    vendor_id: i.vendor_id ?? null,
    price: Number(i.price) || 0,
    qty: Math.max(0, Math.floor(Number(i.qty) || 0)),
  }));

  // Authoritative vendor mapping from the products table — never trust the
  // client's vendor_id (it's routinely missing on lines saved by older
  // storefront code, which is exactly how a qualifying NB Sons basket got
  // quoted Rs 250 on Jul 31). Best-effort: on lookup failure the client
  // value stays, and place_order's floor still can't undercharge.
  const ids = items.map(i => i.id).filter((s): s is string => Boolean(s));
  if (ids.length > 0) {
    const { data } = await supabase
      .from('products')
      .select('id, vendor_id')
      .in('id', ids);
    const vendorByProduct = new Map(
      ((data ?? []) as Array<{ id: string; vendor_id: string | null }>).map(p => [p.id, p.vendor_id]),
    );
    for (const it of items) {
      if (it.id && vendorByProduct.has(it.id)) it.vendor_id = vendorByProduct.get(it.id) ?? null;
    }
  }

  const resolved = await resolveShipping({
    province: opts.province,
    subtotal: opts.subtotal,
    items,
  });
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
