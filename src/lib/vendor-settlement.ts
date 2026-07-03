// Shared vendor-settlement recompute — the ONE place the "order's vendor
// determines its cost" rule is applied to the database. Used by:
//   • dispatchOrderToVendor (src/app/admin/vendor-actions.ts) — WhatsApp
//     dispatch from the order page,
//   • createManualOrder (src/app/admin/orders/new/actions.ts) — manual
//     orders created with a vendor (no WhatsApp dispatch, no vendor_sent_at),
//   • recalcAcquisitionCost (src/app/admin/finance/actions.ts) — the order
//     page's "Recalculate from vendor rate" button (engine only, via
//     computeOrderCosts).
//
// Deliberately NOT a 'use server' file: these run with the service-role
// client and must only be reachable through the permission-checked actions
// above, never as client-invokable endpoints.

import { supabaseAdmin } from './supabase';
import { resolveOrderCosts, type CostItem, type OrderCostResult } from './order-costs';

const round2 = (n: number) => Math.round(n * 100) / 100;

interface CostInputs {
  items: CostItem[];
  vendor: { id: string; name: string | null; commission_pct: number | null; settlement_direction: string | null };
  productsById: Map<string, { vendor_cost: number | null; cost_price: number | null }>;
  /** Σ price × qty over ALL line items, rounded to 2 dp. */
  gross: number;
}

async function loadCostInputs(orderId: string, vendorId: string): Promise<CostInputs | null> {
  const admin = supabaseAdmin();
  const [{ data: order }, { data: vendor }] = await Promise.all([
    admin.from('orders').select('items').eq('id', orderId).single(),
    admin.from('vendors').select('id, name, commission_pct, settlement_direction').eq('id', vendorId).single(),
  ]);
  if (!order || !vendor) return null;

  const items = (order.items ?? []) as CostItem[];
  const ids = Array.from(new Set(items.map(i => i.id).filter((v): v is string => Boolean(v))));
  const { data: prodRows } = ids.length
    ? await admin.from('products').select('id, vendor_cost, cost_price').in('id', ids)
    : { data: [] };
  const productsById = new Map(
    ((prodRows ?? []) as { id: string; vendor_cost: number | null; cost_price: number | null }[])
      .map(p => [p.id, { vendor_cost: p.vendor_cost, cost_price: p.cost_price }]),
  );
  const gross = round2(items.reduce(
    (s, it) => s + Math.max(0, Number(it.price) || 0) * Math.max(0, Number(it.qty) || 0), 0,
  ));
  return {
    items,
    vendor: vendor as CostInputs['vendor'],
    productsById,
    gross,
  };
}

/** Run the cost engine for an order against a vendor, without writing
 *  anything. Used by "Recalculate from vendor rate". */
export async function computeOrderCosts(orderId: string, vendorId: string): Promise<OrderCostResult | null> {
  const inputs = await loadCostInputs(orderId, vendorId);
  if (!inputs) return null;
  return resolveOrderCosts(inputs.items, {
    id: inputs.vendor.id, name: inputs.vendor.name, commission_pct: inputs.vendor.commission_pct,
  }, inputs.productsById);
}

/** Compute and persist the financial split for an order fulfilled by a
 *  vendor. RELAXED matching: the selected vendor covers the WHOLE order —
 *  gross = Σ price × qty over all items, and the vendor cost comes from the
 *  shared engine (per-product vendor_cost, else the vendor's commission %,
 *  else the product's cost_price, else 0). Upserts the vendor_settlements
 *  row (unique on order_id + vendor_id) and drops a stale pending settlement
 *  left behind by a re-dispatch to a different vendor.
 *
 *  Returns the engine result so callers can reuse the SAME totalCost for
 *  orders.acquisition_cost (see applyAutoAcquisitionCost). */
export async function recomputeSettlement(orderId: string, vendorId: string): Promise<OrderCostResult | null> {
  const admin = supabaseAdmin();
  const inputs = await loadCostInputs(orderId, vendorId);
  if (!inputs) return null;

  const costs = resolveOrderCosts(inputs.items, {
    id: inputs.vendor.id, name: inputs.vendor.name, commission_pct: inputs.vendor.commission_pct,
  }, inputs.productsById);

  const gross = inputs.gross;
  const cost = costs.totalCost;
  const margin = round2(gross - cost);

  const direction = inputs.vendor.settlement_direction === 'vendor_collects' ? 'vendor_collects' : 'we_collect';
  const dueTo: 'us' | 'vendor' = direction === 'vendor_collects' ? 'us' : 'vendor';
  const amountDue = direction === 'vendor_collects' ? margin : cost;

  // Re-dispatch to a different vendor: drop the stale pending settlement.
  await admin.from('vendor_settlements')
    .delete()
    .eq('order_id', orderId)
    .eq('status', 'pending')
    .neq('vendor_id', vendorId);

  await admin.from('vendor_settlements').upsert({
    order_id: orderId,
    vendor_id: vendorId,
    // Snapshot the vendor name so the payout row still reads sensibly if the
    // vendor is later deleted (the FK then sets vendor_id null, migration 304).
    vendor_name: inputs.vendor.name ?? null,
    gross_amount: gross,
    vendor_cost: cost,
    our_margin: margin,
    direction,
    amount_due: amountDue,
    due_to: dueTo,
    status: 'pending',
    settled_at: null,
  }, { onConflict: 'order_id,vendor_id' });

  return costs;
}

/** Write the engine's total as the order's acquisition cost, marked 'auto' —
 *  but ONLY when there is no manually entered value to protect (current
 *  value is null, or was itself auto-written). Returns whether it wrote. */
export async function applyAutoAcquisitionCost(orderId: string, totalCost: number): Promise<boolean> {
  const admin = supabaseAdmin();
  const { data: cur } = await admin
    .from('orders')
    .select('acquisition_cost, acquisition_cost_source')
    .eq('id', orderId)
    .single();
  if (!cur) return false;
  if (cur.acquisition_cost != null && cur.acquisition_cost_source !== 'auto') return false;
  const { error } = await admin
    .from('orders')
    .update({ acquisition_cost: totalCost, acquisition_cost_source: 'auto' })
    .eq('id', orderId);
  return !error;
}
