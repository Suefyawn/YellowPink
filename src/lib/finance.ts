// Shared finance helpers used by the admin Finance page and its CSV export
// route, so the per-order money maths lives in exactly one place.
import { supabaseAdmin } from './supabase';

export const FINANCE_RANGES: { key: string; label: string; days: number | null }[] = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
];

// Customer-facing labels for the order.pay_method enum.
export const PAY_METHOD_LABELS: Record<string, string> = {
  cod: 'Cash on Delivery', card: 'Card', bank: 'Bank Transfer',
  jazzcash: 'JazzCash', easypaisa: 'Easypaisa', gift_card: 'Gift card', unknown: 'Unknown',
};

// Orders in these states never count as revenue.
const DEAD_STATES = new Set(['cancelled', 'payment_failed', 'refunded']);

export const fnum = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

export function resolveRange(key?: string) {
  return FINANCE_RANGES.find(r => r.key === key) ?? FINANCE_RANGES[1]; // default 30d
}

/** ISO timestamp `days` ago, or null for "all time". Uses `new Date()` (not
 *  Date.now()), the react-hooks purity lint rejects Date.now() in render. */
export function rangeStartISO(days: number | null): string | null {
  return days ? new Date(new Date().getTime() - days * 86_400_000).toISOString() : null;
}

export interface FinanceOrder {
  id: string; order_number: string | null; created_at: string | null; pay_method: string | null;
  total: number | null; delivery_cost: number | null; payment_fee: number | null;
  utm_source: string | null; status: string | null;
  payment_account: string | null; payment_received_at: string | null;
  acquisition_cost: number | null;
  items?: Array<{ id?: string; qty?: number }> | null;
}

/** Revenue-eligible orders in the window, plus per-order COGS. COGS combines
 *  two cost bases, partitioned by how each line item is sourced so nothing is
 *  double-counted:
 *    • vendor items  → vendor_settlements.vendor_cost (the dispatched snapshot)
 *    • own-stock items → products.cost_price × qty (the acquisition cost)
 *  An order can mix both; vendor lines are exactly the ones whose product has a
 *  vendor_id, so the own-stock pass only counts vendor_id-null products. */
export async function loadFinanceOrders(fromISO: string | null): Promise<{ orders: FinanceOrder[]; cogsByOrder: Map<string, number> }> {
  const admin = supabaseAdmin();
  let oq = admin.from('orders').select('id, order_number, created_at, pay_method, total, delivery_cost, payment_fee, utm_source, status, payment_account, payment_received_at, acquisition_cost, items');
  if (fromISO) oq = oq.gte('created_at', fromISO);
  const { data } = await oq;
  const orders = ((data ?? []) as FinanceOrder[]).filter(o => !DEAD_STATES.has(o.status ?? ''));

  const cogsByOrder = new Map<string, number>();
  const ids = orders.map(o => o.id);
  if (ids.length) {
    // Vendor COGS, the snapshot recorded when each order was dispatched.
    const { data: settle } = await admin.from('vendor_settlements').select('order_id, vendor_cost').in('order_id', ids);
    const set = new Set(ids);
    for (const s of (settle ?? []) as { order_id: string; vendor_cost: number | null }[]) {
      if (set.has(s.order_id)) cogsByOrder.set(s.order_id, (cogsByOrder.get(s.order_id) ?? 0) + Number(s.vendor_cost ?? 0));
    }

    // Own-stock COGS, acquisition cost of every line whose product isn't
    // vendor-sourced (vendor lines are already covered above).
    const productIds = new Set<string>();
    for (const o of orders) for (const it of o.items ?? []) if (it?.id) productIds.add(it.id);
    if (productIds.size) {
      const { data: prods } = await admin
        .from('products')
        .select('id, vendor_id, cost_price')
        .in('id', [...productIds]);
      const costMap = new Map(
        ((prods ?? []) as { id: string; vendor_id: string | null; cost_price: number | null }[])
          .map(p => [p.id, { vendorId: p.vendor_id, cost: Number(p.cost_price ?? 0) }]),
      );
      for (const o of orders) {
        let own = 0;
        for (const it of o.items ?? []) {
          const p = it?.id ? costMap.get(it.id) : undefined;
          if (p && p.vendorId == null && p.cost > 0) own += p.cost * (Number(it.qty) || 0);
        }
        if (own > 0) cogsByOrder.set(o.id, (cogsByOrder.get(o.id) ?? 0) + own);
      }
    }
  }

  // Per-order acquisition cost (staff-entered actual goods cost) overrides the
  // computed vendor+own-stock estimate, drop-ship prices vary per order.
  for (const o of orders) {
    if (o.acquisition_cost != null) cogsByOrder.set(o.id, Number(o.acquisition_cost));
  }

  return { orders, cogsByOrder };
}

export interface OrderFinanceRow {
  id: string; order_number: string | null; created_at: string | null; method: string;
  total: number; cogs: number; delivery: number; fee: number; costs: number;
  gross: number; margin: number; payment_account: string | null; payment_received_at: string | null;
}

/** Per-order P&L row: total minus the costs recorded for that order. */
export function toOrderFinanceRow(o: FinanceOrder, cogsByOrder: Map<string, number>): OrderFinanceRow {
  const cogs = cogsByOrder.get(o.id) ?? 0;
  const delivery = fnum(o.delivery_cost);
  const fee = fnum(o.payment_fee);
  const total = fnum(o.total);
  const costs = cogs + delivery + fee;
  const gross = total - costs;
  return {
    id: o.id, order_number: o.order_number, created_at: o.created_at, method: o.pay_method ?? 'unknown',
    total, cogs, delivery, fee, costs, gross, margin: total > 0 ? (gross / total) * 100 : 0,
    payment_account: o.payment_account, payment_received_at: o.payment_received_at,
  };
}
