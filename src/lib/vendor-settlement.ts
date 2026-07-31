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

/** Keep a returned order's round-trip charge in sync with the vendor
 *  payable. Called from two places with the same semantics: the return
 *  transition (vendor's default return_fee) and the Order costs card (the
 *  ACTUAL amount the vendor billed, typed by staff once known).
 *
 *  Only self-delivering vendors are synced — when the store ships via its
 *  own courier, the courier's bill is the store's loss alone and no payable
 *  is created. A settled row is never rewritten (that money already moved).
 *
 *  vendor_collects: on a returned order the sale payout is void, so the
 *  (order, vendor) slot holds at most a fee row — written to match `fee`,
 *  deleted when the fee is cleared. we_collect: the pending payable's
 *  amount_due becomes goods cost + fee, margin −fee (the fee is a real
 *  loss; the goods part isn't — it bought back stock). */
export async function syncReturnChargeToVendor(
  orderId: string,
  vendorId: string,
  fee: number | null,
): Promise<'synced' | 'skipped_settled' | 'not_self_delivering'> {
  const admin = supabaseAdmin();
  const { data: vendor } = await admin
    .from('vendors').select('settlement_direction, self_delivers')
    .eq('id', vendorId).maybeSingle();
  if (!vendor?.self_delivers) return 'not_self_delivering';
  const f = Math.max(0, Number(fee) || 0);
  const { data: row } = await admin
    .from('vendor_settlements').select('id, status, vendor_cost')
    .eq('order_id', orderId).eq('vendor_id', vendorId).maybeSingle();
  if (row?.status === 'settled') return 'skipped_settled';

  if (vendor.settlement_direction === 'vendor_collects') {
    if (row && f > 0) {
      await admin.from('vendor_settlements').update({
        gross_amount: 0, vendor_cost: f, our_margin: -f, amount_due: f, due_to: 'vendor',
      }).eq('id', row.id);
    } else if (row && f === 0) {
      await admin.from('vendor_settlements').delete().eq('id', row.id);
    } else if (!row && f > 0) {
      await admin.from('vendor_settlements').insert({
        order_id: orderId, vendor_id: vendorId,
        gross_amount: 0, vendor_cost: f, our_margin: -f,
        direction: 'vendor_collects', amount_due: f, due_to: 'vendor', status: 'pending',
      });
    }
  } else {
    if (row) {
      await admin.from('vendor_settlements').update({
        our_margin: -f, amount_due: round2(Number(row.vendor_cost) + f),
      }).eq('id', row.id);
    } else if (f > 0) {
      await admin.from('vendor_settlements').insert({
        order_id: orderId, vendor_id: vendorId,
        gross_amount: 0, vendor_cost: 0, our_margin: -f,
        direction: 'we_collect', amount_due: f, due_to: 'vendor', status: 'pending',
      });
    }
  }
  return 'synced';
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

  const { error } = await admin.from('vendor_settlements').upsert({
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
  if (error) {
    // A settlement that fails to persist means the Payouts ledger silently
    // drifts from reality (this exact failure hid an unapplied migration in
    // production for a day). Fail loudly so the caller's toast reports it.
    const { log } = await import('./logger');
    log.error('vendor_settlement.upsert_failed', { orderId, vendorId, error: error.message });
    return null;
  }

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
