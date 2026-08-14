'use server';

// Editing an unshipped order's line items in place — Shopify's "Edit order".
// A customer who changes a shade or a quantity on the COD confirmation call
// used to force a cancel-and-recreate round trip; this keeps the order (its
// number, timeline, confirmation state) and moves only what changed.
//
// Discipline mirrors the two paths it sits between:
//   • createManualOrder — added/increased lines are stock-gated and priced
//     from products/product_variants on the server (client prices are never
//     trusted), and debits go through the inventory ledger with reason
//     'order'.
//   • restockCancelledOrder — removed/decreased lines credit stock back per
//     (product, variant) with reason 'cancellation', which the RPC already
//     guards for untracked products and clamps at zero.
// Shipping and discount_amount stay AS RECORDED (the operator agreed those
// on the call); only the items subtotal and the total recompute. After the
// rewrite the vendor settlement re-runs so payouts and margins follow the
// new items, and the edit lands on the order timeline + audit log.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';
import { notifyStockRanOut } from '@/lib/stock-alerts';
import { brandPlusName } from '@/lib/product-display';
import { recomputeSettlement, applyAutoAcquisitionCost } from '@/lib/vendor-settlement';

// Pre-shipment statuses only. Once a parcel is booked/handed over (shipped,
// delivered) the goods have left the shelf and edits belong to the Returns
// flow; cancelled/returned/refunded/payment_* orders are financially closed.
const EDITABLE_STATUSES = ['pending', 'processing'];

// Legacy WordPress-era orders carry numeric item ids; only real UUIDs can be
// looked up (a non-uuid value would cast-error the products query).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EditSearchVariant { id: string; label: string; price: number; stock: number | null }
export interface EditSearchProduct {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  stock: number | null;
  track_inventory: boolean | null;
  /** Enabled shades/sizes. Empty for a simple product. */
  variants: EditSearchVariant[];
}

interface RawVariantRow {
  id: string; product_id: string; sku: string | null; price: number; stock: number | null; enabled?: boolean;
  variant_attribute_values?: Array<{ attribute_values?: { value?: string | null } | null }> | null;
}

// Readable shade/size label built from the variant's attribute values
// ("Mont Blanc · 30ml"), falling back to the SKU — same construction as the
// manual order form's picker.
function variantLabel(v: RawVariantRow): string {
  return (v.variant_attribute_values ?? [])
    .map(x => x.attribute_values?.value)
    .filter((x): x is string => Boolean(x))
    .join(' · ') || v.sku || 'Option';
}

/** Product lookup for the order-edit add-line search. Published products
 *  only (same rule as adding the line itself), with their enabled variants,
 *  because a product with shades can only be ordered AS a shade. Same gate
 *  as the edit action. */
export async function searchProductsForOrderEdit(q: string): Promise<EditSearchProduct[]> {
  await assertPermission('orders.edit');
  // Strip the characters that break PostgREST .or() filters (same scrubbing
  // as the orders-list search).
  const term = (q ?? '').replace(/[(),*]/g, ' ').trim();
  if (term.length < 2) return [];
  const admin = supabaseAdmin();
  const { data: rows } = await admin
    .from('products')
    .select('id, name, brand, price, stock, track_inventory')
    .eq('status', 'published')
    .or(`name.ilike.%${term}%,brand.ilike.%${term}%`)
    .order('name')
    .limit(8);
  const products = (rows ?? []) as Omit<EditSearchProduct, 'variants'>[];
  if (products.length === 0) return [];
  const { data: vRows } = await admin
    .from('product_variants')
    .select('id, product_id, sku, price, stock, variant_attribute_values(attribute_values(value))')
    .eq('enabled', true)
    .in('product_id', products.map(p => p.id))
    .order('sort_order');
  const variantsByProduct = new Map<string, EditSearchVariant[]>();
  for (const v of (vRows ?? []) as RawVariantRow[]) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push({ id: v.id, label: variantLabel(v), price: v.price, stock: v.stock });
    variantsByProduct.set(v.product_id, list);
  }
  return products.map(p => ({ ...p, variants: variantsByProduct.get(p.id) ?? [] }));
}

// Existing line shape (denormalised snapshot). Unknown fields ride along
// untouched — a surviving line keeps everything it had except qty.
interface OrderLine {
  id: string;
  name?: string;
  brand?: string | null;
  price: number;
  qty: number;
  variant_id?: string | null;
  variant_label?: string | null;
  [key: string]: unknown;
}

interface AddedLineInput { product_id: string; variant_id?: string | null; qty: number }

function fail(orderId: string, msg: string): never {
  redirect(`/admin/orders/${orderId}?err=${encodeURIComponent(msg)}`);
}

const lineKey = (pid: string, vid: string | null | undefined) => `${pid}::${vid ?? ''}`;
const lineLabel = (l: { brand?: string | null; name?: string; variant_label?: string | null }) =>
  `${brandPlusName(l.brand ?? null, l.name ?? 'item')}${l.variant_label ? ` (${l.variant_label})` : ''}`;

export async function editOrderItems(orderId: string, formData: FormData): Promise<void> {
  const session = await assertPermission('orders.edit');
  const admin = supabaseAdmin();

  const { data: orderRow } = await admin
    .from('orders')
    .select('id, order_number, status, items, subtotal, shipping, discount_amount, total, vendor_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!orderRow) fail(orderId, 'Order not found.');
  const o = orderRow as {
    id: string; order_number: string; status: string | null; items: OrderLine[] | null;
    subtotal: number; shipping: number; discount_amount: number | null; total: number; vendor_id: string | null;
  };
  if (!EDITABLE_STATUSES.includes(o.status ?? 'pending')) {
    fail(orderId, 'Only unshipped orders (Order received / Preparing) can have their items edited.');
  }

  // ── Parse: surviving quantities by index + added lines ────────────────────
  const oldItems = (o.items ?? []) as OrderLine[];
  const newQtyByIndex = oldItems.map((line, index) => {
    const raw = formData.get(`line__${index}__qty`);
    if (raw == null || raw === '') return line.qty; // untouched line
    const qty = Number(raw);
    if (!Number.isInteger(qty) || qty < 0 || qty > 500) {
      fail(orderId, 'Each quantity must be a whole number between 0 (remove) and 500.');
    }
    return qty;
  });

  let added: AddedLineInput[];
  try {
    added = JSON.parse((formData.get('added') as string) || '[]') as AddedLineInput[];
  } catch {
    fail(orderId, 'The added lines could not be read — please re-add them.');
  }
  if (!Array.isArray(added)) fail(orderId, 'The added lines could not be read — please re-add them.');
  for (const a of added) {
    if (!a?.product_id || !UUID_RE.test(a.product_id) || !Number.isInteger(a.qty) || a.qty < 1 || a.qty > 500) {
      fail(orderId, 'Each added line needs a product and a quantity between 1 and 500.');
    }
    if (a.variant_id != null && !UUID_RE.test(a.variant_id)) {
      fail(orderId, 'An added line names an option that does not exist.');
    }
  }

  if (newQtyByIndex.every((q, i) => q === oldItems[i]?.qty) && added.length === 0) {
    fail(orderId, 'Nothing changed — adjust a quantity or add a product first.');
  }

  // ── Resolve products/variants for everything the edit touches ────────────
  const involvedIds = Array.from(new Set([
    ...oldItems.map(l => l.id).filter((v): v is string => typeof v === 'string' && UUID_RE.test(v)),
    ...added.map(a => a.product_id),
  ]));
  const { data: prodRows, error: prodErr } = involvedIds.length
    ? await admin
        .from('products')
        .select('id, slug, name, brand, category, image_url, price, stock, track_inventory, status')
        .in('id', involvedIds)
    : { data: [], error: null };
  if (prodErr) fail(orderId, `Could not load products: ${prodErr.message}`);
  type ProductRow = {
    id: string; slug: string; name: string; brand: string | null; category: string | null;
    image_url: string | null; price: number; stock: number | null; track_inventory: boolean | null; status: string;
  };
  const productById = new Map(((prodRows ?? []) as ProductRow[]).map(p => [p.id, p]));

  const involvedVariantIds = Array.from(new Set([
    ...oldItems.map(l => l.variant_id).filter((v): v is string => typeof v === 'string' && UUID_RE.test(v)),
    ...added.map(a => a.variant_id).filter((v): v is string => Boolean(v)),
  ]));
  const variantById = new Map<string, RawVariantRow>();
  if (involvedVariantIds.length > 0) {
    const { data: vRows, error: vErr } = await admin
      .from('product_variants')
      .select('id, product_id, sku, price, stock, enabled, variant_attribute_values(attribute_values(value))')
      .in('id', involvedVariantIds);
    if (vErr) fail(orderId, `Could not load product options: ${vErr.message}`);
    for (const v of (vRows ?? []) as RawVariantRow[]) variantById.set(v.id, v);
  }

  // Added lines: server-priced from the catalogue, published products only,
  // variants must be enabled and belong to their product — exactly the
  // discipline createManualOrder applies (the client's prices never count).
  for (const a of added) {
    const p = productById.get(a.product_id);
    if (!p || p.status !== 'published') fail(orderId, 'An added product no longer exists or is not published.');
    if (a.variant_id) {
      const v = variantById.get(a.variant_id);
      if (!v || v.enabled === false) fail(orderId, 'An added option is no longer available — pick another.');
      if (v.product_id !== a.product_id) fail(orderId, 'An added option does not belong to its product.');
    }
  }

  // ── Rebuild the items array ───────────────────────────────────────────────
  // Surviving lines keep their whole snapshot (price included) with the new
  // qty; an added line that matches a surviving (product, variant) merges
  // into it instead of duplicating the row.
  const newItems: OrderLine[] = [];
  oldItems.forEach((line, index) => {
    const qty = newQtyByIndex[index];
    if (qty > 0) newItems.push({ ...line, qty });
  });
  for (const a of added) {
    const k = lineKey(a.product_id, a.variant_id ?? null);
    const existing = newItems.find(l => typeof l.id === 'string' && lineKey(l.id, l.variant_id ?? null) === k);
    if (existing) {
      existing.qty += a.qty;
      continue;
    }
    const p = productById.get(a.product_id)!;
    const v = a.variant_id ? variantById.get(a.variant_id)! : null;
    newItems.push({
      id: p.id, slug: p.slug, name: p.name, brand: p.brand,
      category: p.category, image_url: p.image_url,
      // The variant's own price is what place_order would charge.
      price: v ? v.price : p.price,
      qty: a.qty,
      // Without this a later cancellation would credit the parent counter
      // while this edit debited the shade.
      ...(v ? { variant_id: v.id, variant_label: variantLabel(v) } : {}),
    });
  }
  if (newItems.length === 0) {
    fail(orderId, 'An edit must leave at least one item on the order — to call the whole order off, cancel it instead.');
  }

  // ── Stock deltas per (product, variant) ───────────────────────────────────
  const totals = new Map<string, { productId: string; variantId: string | null; delta: number }>();
  const bump = (pid: string, vid: string | null | undefined, qty: number) => {
    if (typeof pid !== 'string' || !UUID_RE.test(pid)) return; // legacy line: no ledger to move
    const k = lineKey(pid, vid);
    const cur = totals.get(k) ?? { productId: pid, variantId: vid ?? null, delta: 0 };
    cur.delta += qty;
    totals.set(k, cur);
  };
  for (const l of oldItems) bump(l.id, l.variant_id ?? null, -l.qty);
  for (const l of newItems) bump(l.id, l.variant_id ?? null, l.qty);
  const deltas = Array.from(totals.values()).filter(d => d.delta !== 0);

  // Increases are stock-gated like a manual order line: the shade's own count
  // when the line names one (the parent counter is an aggregate), only for
  // own-stock tracked products, and only for the EXTRA units — the original
  // qty was already debited at placement.
  const shortages: string[] = [];
  for (const d of deltas) {
    if (d.delta <= 0) continue;
    const p = productById.get(d.productId);
    if (!p) fail(orderId, 'A product on this order no longer exists — its quantity can only be reduced.');
    if (!(p.track_inventory ?? true)) continue;
    const v = d.variantId ? variantById.get(d.variantId) : null;
    if (d.variantId && !v) fail(orderId, 'An option on this order no longer exists — its quantity can only be reduced.');
    const available = v ? (v.stock ?? 0) : (p.stock ?? 0);
    if (available < d.delta) shortages.push(`${p.name} (need ${d.delta} more, have ${available})`);
  }
  if (shortages.length) fail(orderId, `Not enough stock: ${shortages.join('; ')}`);

  // ── Totals: shipping and discount stay as recorded ────────────────────────
  const subtotal = newItems.reduce((s, l) => s + (Number(l.price) || 0) * l.qty, 0);
  const shipping = Number(o.shipping ?? 0);
  const discount = Number(o.discount_amount ?? 0);
  const total = Math.max(0, subtotal + shipping - discount);

  const { error: updErr } = await admin
    .from('orders')
    .update({ items: newItems, subtotal, total })
    .eq('id', orderId);
  if (updErr) fail(orderId, `Could not save the edit: ${updErr.message}`);

  // ── Stock through the ledger (after the order row holds the new truth) ───
  // Credits use reason 'cancellation' (the partial symmetric of the cancel
  // restock; the RPC skips untracked products and clamps at zero), debits use
  // reason 'order' like place_order/createManualOrder. A ledger failure
  // shouldn't orphan the edit silently — it's logged for Inventory to fix.
  const debitedProductIds: string[] = [];
  for (const d of deltas) {
    const p = productById.get(d.productId);
    if (!p || !(p.track_inventory ?? true)) continue; // own-stock tracked only
    const { error } = await admin.rpc('record_stock_change' as never, {
      p_product_id:  d.productId,
      p_variant_id:  d.variantId,
      p_qty_delta:   -d.delta, // delta>0 = more sold = stock down; delta<0 = credited back
      p_reason:      d.delta > 0 ? 'order' : 'cancellation',
      p_order_id:    orderId,
      p_return_id:   null,
      p_actor_kind:  session.isOwner ? 'owner' : 'staff',
      p_actor_email: session.email ?? null,
      p_note:        `Order items edited ${o.order_number}`,
    } as never);
    if (error) {
      await logAudit(session, {
        action: 'order.items_edit.stock_error', entity: 'orders', entity_id: orderId,
        diff: { product: d.productId, variant: d.variantId, delta: d.delta, error: (error as { message?: string }).message },
      });
    } else if (d.delta > 0) {
      debitedProductIds.push(d.productId);
    }
  }
  // Same sold-out alert as the storefront path: an edit can take the last one.
  if (debitedProductIds.length > 0) void notifyStockRanOut(debitedProductIds);

  // Vendor economics follow the new items — same shared engine as dispatch
  // and manual creation, run against the freshly written orders.items.
  if (o.vendor_id) {
    const costs = await recomputeSettlement(orderId, o.vendor_id);
    if (costs) await applyAutoAcquisitionCost(orderId, costs.totalCost);
  }

  // ── Timeline comment + audit ─────────────────────────────────────────────
  const changes: string[] = [];
  oldItems.forEach((line, index) => {
    const qty = newQtyByIndex[index];
    if (qty === line.qty) return;
    changes.push(qty === 0 ? `removed ${lineLabel(line)}` : `${lineLabel(line)} ${line.qty}→${qty}`);
  });
  for (const a of added) {
    const p = productById.get(a.product_id)!;
    const v = a.variant_id ? variantById.get(a.variant_id)! : null;
    changes.push(`added ${lineLabel({ brand: p.brand, name: p.name, variant_label: v ? variantLabel(v) : null })} ×${a.qty}`);
  }
  await admin.from('order_comments').insert({
    order_id: orderId,
    author: session.email || 'staff',
    body: `Items edited: ${changes.join('; ')}. Subtotal PKR ${Number(o.subtotal ?? 0).toLocaleString()} → PKR ${subtotal.toLocaleString()}; shipping and discount unchanged.`.slice(0, 2000),
  });

  await logAudit(session, {
    action: 'order.items_edit',
    entity: 'orders',
    entity_id: orderId,
    diff: {
      order_number: o.order_number,
      before: { items: oldItems, subtotal: o.subtotal, total: o.total },
      after: { items: newItems, subtotal, total },
    },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/orders');
  revalidatePath('/admin/inventory');
  redirect(`/admin/orders/${orderId}?items=saved`);
}
