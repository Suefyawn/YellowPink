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
import { notifyStockRanOut } from '@/lib/stock-alerts';
import { sendOrderConfirmationEmail } from '@/lib/email';
import { recomputeSettlement, applyAutoAcquisitionCost } from '@/lib/vendor-settlement';

export interface ManualOrderState {
  error: string | null;
}

export interface CustomerMatch {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  zip: string | null;
}

/** Repeat-customer lookup for the manual order form: a phone/name/email
 *  fragment against past orders, newest first, deduped to one entry per
 *  customer (phone-digits key, email fallback). Same gate as creating the
 *  manual order itself. */
export async function searchCustomersForOrder(q: string): Promise<CustomerMatch[]> {
  await assertPermission('orders.edit');
  // Strip the characters that break PostgREST .or() filters (same
  // scrubbing as the orders-list search).
  const term = (q ?? '').replace(/[(),*]/g, ' ').trim();
  if (term.length < 3) return [];
  const filter = `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`;
  const { data } = await supabaseAdmin()
    .from('orders')
    .select('first_name, last_name, email, phone, address, city, province, zip, created_at')
    .or(filter)
    .order('created_at', { ascending: false })
    .limit(40);
  const seen = new Set<string>();
  const out: CustomerMatch[] = [];
  for (const row of (data ?? []) as Array<CustomerMatch & { created_at: string }>) {
    const key = (row.phone ?? '').replace(/\D/g, '') || (row.email ?? '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const { created_at: _ca, ...match } = row;
    void _ca;
    out.push(match);
    if (out.length >= 8) break;
  }
  return out;
}

interface LineInput { id: string; variantId?: string | null; qty: number; price: number }

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
  const vendorId  = ((formData.get('vendor_id') as string) ?? '').trim() || null;

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

  // Shade-level rows. place_order gates and debits the VARIANT, so a manual
  // order has to do the same or it checks one number and moves another.
  const variantIds = lines.map(l => l.variantId).filter((v): v is string => Boolean(v));
  const variantById = new Map<string, { id: string; product_id: string; stock: number | null; price: number }>();
  if (variantIds.length > 0) {
    const { data: vRows, error: vErr } = await admin
      .from('product_variants').select('id, product_id, stock, price, enabled').in('id', variantIds);
    if (vErr) return { error: `Could not load product options: ${vErr.message}` };
    for (const v of (vRows ?? []) as Array<{ id: string; product_id: string; stock: number | null; price: number; enabled: boolean }>) {
      if (!v.enabled) return { error: 'One of the selected options is no longer available — remove it and try again.' };
      variantById.set(v.id, v);
    }
    for (const l of lines) {
      if (!l.variantId) continue;
      const v = variantById.get(l.variantId);
      if (!v) return { error: 'A selected option no longer exists — remove it and try again.' };
      if (v.product_id !== l.id) return { error: 'A selected option does not belong to its product.' };
    }
  }

  // Optional fulfilment vendor: must still exist and be active. The vendor's
  // rate drives the auto acquisition cost + settlement written after insert.
  if (vendorId) {
    const { data: vendorRow, error: vendorErr } = await admin
      .from('vendors').select('id, active').eq('id', vendorId).maybeSingle();
    if (vendorErr) return { error: `Could not check the vendor: ${vendorErr.message}` };
    if (!vendorRow || !vendorRow.active) {
      return { error: 'The selected vendor no longer exists or is inactive — pick another or leave it blank.' };
    }
  }

  const shortages: string[] = [];
  for (const l of lines) {
    const p = byId.get(l.id);
    if (!p) return { error: 'A selected product no longer exists — remove it and try again.' };
    const v = l.variantId ? variantById.get(l.variantId) : null;
    // The parent counter is an aggregate. Gating a shade line on it refused
    // orders the warehouse could fill (NARS: parent 1, shades 328) and let
    // through ones it could not.
    const available = v ? (v.stock ?? 0) : (p.stock ?? 0);
    if ((p.track_inventory ?? true) && available < l.qty) {
      shortages.push(`${p.name} (need ${l.qty}, have ${available})`);
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
      // Without this a cancellation would credit the parent counter while the
      // sale debited the shade — the two drift apart by one order every time.
      ...(l.variantId ? { variant_id: l.variantId } : {}),
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
        // Fulfilment vendor (optional). vendor_sent_at stays null — no
        // WhatsApp dispatch happened; the order page's dispatch button
        // records that separately.
        vendor_id: vendorId,
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
        p_variant_id:  l.variantId ?? null,
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

  // Same sold-out alert as the storefront path: a manual order can take the
  // last one just as easily.
  void notifyStockRanOut(lines.map(l => l.id));

  // Vendor economics — same shared path as dispatchOrderToVendor: the
  // engine's total becomes the settlement's vendor_cost AND the order's
  // auto acquisition cost, so the two figures agree by construction.
  if (vendorId) {
    const costs = await recomputeSettlement(order.id, vendorId);
    if (costs) await applyAutoAcquisitionCost(order.id, costs.totalCost);
  }

  await logAudit(session, {
    action: 'order.create_manual',
    entity: 'orders',
    entity_id: order.id,
    diff: { order_number: order.order_number, total, items: lines.length, channel: 'admin-manual', vendor_id: vendorId },
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
