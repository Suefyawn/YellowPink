'use server';

// Manual order creation — for the WhatsApp/phone/DM orders this market runs
// on. Deliberately does NOT go through the storefront place_order RPC: that
// path hard-rejects any discount without a coupon and any shipping under the
// zone floor, both of which are legitimate owner decisions on a manual order
// ("I told her 200 off", "I'll ship it free"). Instead this trusted, staff-
// gated path recomputes what must be consistent (line totals → totals), keeps
// the same side-effects as a storefront order (stock via the inventory
// ledger, audit log, optional confirmation email), and marks the order's
// origin so Finance/attribution can tell the channels apart.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';
import { sendOrderConfirmationEmail } from '@/lib/email';

export interface ManualOrderState {
  error: string | null;
}

interface LineInput { id: string; qty: number; price: number }

function makeOrderNumber(): string {
  // Same scheme as the storefront checkout (timestamp base36 + 4 random
  // chars from an unambiguous alphabet); the DB UNIQUE constraint is the
  // backstop and we retry once on collision.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let rand = '';
  for (const b of bytes) rand += alphabet[b % alphabet.length];
  return 'YP-' + Date.now().toString(36).slice(-5).toUpperCase() + rand;
}

export async function createManualOrder(
  _prev: ManualOrderState,
  formData: FormData,
): Promise<ManualOrderState> {
  const session = await assertPermission('orders.edit');

  // ── Parse + validate ──────────────────────────────────────────────────────
  const firstName = ((formData.get('first_name') as string) ?? '').trim();
  const lastName  = ((formData.get('last_name') as string) ?? '').trim();
  const phone     = ((formData.get('phone') as string) ?? '').trim();
  const email     = ((formData.get('email') as string) ?? '').trim();
  const address   = ((formData.get('address') as string) ?? '').trim();
  const city      = ((formData.get('city') as string) ?? '').trim();
  const province  = ((formData.get('province') as string) ?? '').trim();
  const payMethod = ((formData.get('pay_method') as string) ?? 'cod').trim();
  const status    = ((formData.get('status') as string) ?? 'pending').trim();
  const sendEmail = formData.get('send_confirmation') === 'true';
  const shipping  = Number(formData.get('shipping') ?? 0);
  const discount  = Number(formData.get('discount_amount') ?? 0);

  if (!firstName) return { error: 'Customer first name is required.' };
  if (!phone) return { error: 'Phone number is required (delivery + WhatsApp updates).' };
  if (!address || !city) return { error: 'Delivery address and city are required.' };
  if (!['cod', 'bank'].includes(payMethod)) return { error: 'Payment method must be COD or bank transfer.' };
  if (!['pending', 'processing'].includes(status)) return { error: 'Initial status must be Pending or Processing.' };
  if (!Number.isFinite(shipping) || shipping < 0) return { error: 'Shipping must be zero or more.' };
  if (!Number.isFinite(discount) || discount < 0) return { error: 'Discount must be zero or more.' };
  if (sendEmail && !email) return { error: 'Enter an email address to send the confirmation to.' };

  let lines: LineInput[];
  try {
    lines = JSON.parse((formData.get('items') as string) ?? '[]') as LineInput[];
  } catch {
    return { error: 'Order items could not be read — please re-add them.' };
  }
  if (!Array.isArray(lines) || lines.length === 0) return { error: 'Add at least one product to the order.' };
  for (const l of lines) {
    if (!l?.id || !Number.isInteger(l.qty) || l.qty < 1 || l.qty > 500) {
      return { error: 'Each line needs a product and a quantity between 1 and 500.' };
    }
    if (!Number.isFinite(l.price) || l.price < 0) return { error: 'Line prices must be zero or more.' };
  }

  // ── Resolve products + stock-gate tracked lines ───────────────────────────
  const admin = supabaseAdmin();
  const ids = lines.map(l => l.id);
  const { data: productRows, error: prodErr } = await admin
    .from('products')
    .select('id, slug, name, brand, category, image_url, price, stock, track_inventory, status')
    .in('id', ids);
  if (prodErr) return { error: `Could not load products: ${prodErr.message}` };
  const byId = new Map((productRows ?? []).map(p => [p.id as string, p]));

  const shortages: string[] = [];
  for (const l of lines) {
    const p = byId.get(l.id);
    if (!p) return { error: 'A selected product no longer exists — remove it and try again.' };
    if ((p.track_inventory ?? true) && (p.stock ?? 0) < l.qty) {
      shortages.push(`${p.name} (need ${l.qty}, have ${p.stock ?? 0})`);
    }
  }
  if (shortages.length) return { error: `Not enough stock: ${shortages.join('; ')}` };

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  if (discount > subtotal) return { error: 'Discount cannot exceed the items subtotal.' };
  const total = subtotal + shipping - discount;

  const items = lines.map(l => {
    const p = byId.get(l.id)!;
    return {
      id: p.id, slug: p.slug, name: p.name, brand: p.brand,
      category: p.category, image_url: p.image_url,
      price: l.price, qty: l.qty,
    };
  });

  // ── Insert (retry once on an order-number collision) ─────────────────────
  let order: { id: string; order_number: string } | null = null;
  let lastErr = '';
  for (let attempt = 0; attempt < 2 && !order; attempt++) {
    const { data, error } = await admin
      .from('orders')
      .insert({
        order_number: makeOrderNumber(),
        email: email || null,
        first_name: firstName,
        last_name: lastName,
        phone, address, city,
        province: province || null,
        pay_method: payMethod,
        subtotal, shipping, total,
        discount_amount: discount,
        items,
        status,
        user_id: null,
        // Channel marker: keeps manual orders distinguishable in Finance /
        // attribution without a schema change.
        utm_source: 'admin-manual',
        utm_medium: 'manual',
      })
      .select('id, order_number')
      .single();
    if (data) { order = data as { id: string; order_number: string }; break; }
    lastErr = error?.message ?? 'unknown error';
    if (!/duplicate|unique/i.test(lastErr)) break;
  }
  if (!order) return { error: `Could not create the order: ${lastErr}` };

  // ── Stock through the ledger (same semantics as place_order) ──────────────
  for (const l of lines) {
    const p = byId.get(l.id)!;
    if (p.track_inventory ?? true) {
      const { error } = await admin.rpc('record_stock_change' as never, {
        p_product_id:  l.id,
        p_variant_id:  null,
        p_qty_delta:   -l.qty,
        p_reason:      'order',
        p_order_id:    order.id,
        p_actor_kind:  session.isOwner ? 'owner' : 'staff',
        p_actor_email: session.email,
        p_note:        `Manual order ${order.order_number}`,
      } as never);
      // A ledger failure shouldn't orphan the order silently — surface it,
      // the operator can adjust stock from Inventory.
      if (error) {
        await logAudit(session, { action: 'order.create_manual.stock_error', entity: 'orders', entity_id: order.id, diff: { product: l.id, error: (error as { message?: string }).message } });
      }
    }
  }

  await logAudit(session, {
    action: 'order.create_manual',
    entity: 'orders',
    entity_id: order.id,
    diff: { order_number: order.order_number, total, items: lines.length, channel: 'admin-manual' },
  });

  // Emails: customer confirmation only when asked; internal new-order email
  // is skipped (the operator IS the one creating it).
  if (sendEmail && email) {
    void sendOrderConfirmationEmail({
      email,
      order_number: order.order_number,
      first_name: firstName, last_name: lastName,
      phone, city, province,
      total, pay_method: payMethod,
      items: items.map(i => ({ name: i.name, brand: i.brand ?? undefined, qty: i.qty, price: i.price })),
    }).catch(() => {});
  }

  revalidatePath('/admin/orders');
  redirect(`/admin/orders/${order.id}`);
}
