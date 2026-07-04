// Shared finance helpers used by the admin Finance page and its CSV export
// route, so the per-order money maths lives in exactly one place.
import { supabaseAdmin } from './supabase';
import { fetchAll } from './fetch-all';

export const FINANCE_RANGES: { key: string; label: string; days: number | null }[] = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
];

// Canonical pay-method labels moved to @/types (PAY_METHOD_LABELS) so client
// components can share them; import from there.

// Orders in these states never count as revenue. Matches the Analytics
// revenue view (migration 023 v_orders_revenue): `payment_pending` orders
// are unpaid — the gateway never confirmed — so counting them inflated the
// "Revenue (paid orders)" P&L line.
//
// Intentional difference from v_orders_revenue on COUNT (not revenue): that
// view keeps `refunded` rows with revenue zeroed, so the dashboard/Analytics
// order count includes refunded orders as *placed* orders; the P&L here drops
// them entirely because a refunded order contributes neither revenue nor a
// meaningful cost line to profit & loss. Revenue is identical either way
// (refunded → 0); the two surfaces answer different questions —
// "orders placed" (dashboard) vs "orders that produced P&L" (finance) — so
// their order counts can differ by the number of refunds. Keep both rules
// here so they don't silently drift.
const DEAD_STATES = new Set(['cancelled', 'payment_failed', 'payment_pending', 'refunded']);

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

/** Revenue-eligible orders in the window, plus per-order COGS.
 *
 *  The primary source is now `orders.acquisition_cost`: since the unified
 *  vendor/cost model it is AUTO-FILLED at vendor dispatch (and on manual-
 *  order creation with a vendor) by the shared engine in
 *  src/lib/order-costs.ts — the same figure as the settlement's vendor_cost
 *  by construction — and staff can override it on the Order costs card
 *  (acquisition_cost_source 'auto' vs 'manual'). Whenever it is set, it
 *  overrides everything below for that order.
 *
 *  Orders WITHOUT an acquisition cost (legacy / never dispatched) fall back
 *  to the computed estimate, combining two cost bases partitioned by how
 *  each line item is sourced so nothing is double-counted:
 *    • vendor items  → vendor_settlements.vendor_cost (the dispatched snapshot)
 *    • own-stock items → products.cost_price × qty (the acquisition cost)
 *  An order can mix both; vendor lines are exactly the ones whose product has a
 *  vendor_id, so the own-stock pass only counts vendor_id-null products. */
export async function loadFinanceOrders(fromISO: string | null): Promise<{ orders: FinanceOrder[]; cogsByOrder: Map<string, number> }> {
  const admin = supabaseAdmin();
  // fetchAll pages past PostgREST's silent 1000-row cap; without it the P&L
  // (and its CSV export) quietly dropped every order past #1000 in the window.
  let oq = admin.from('orders').select('id, order_number, created_at, pay_method, total, delivery_cost, payment_fee, utm_source, status, payment_account, payment_received_at, acquisition_cost, items');
  if (fromISO) oq = oq.gte('created_at', fromISO);
  const { data } = await fetchAll<FinanceOrder>(oq.order('created_at', { ascending: true }));
  const orders = (data ?? []).filter(o => !DEAD_STATES.has(o.status ?? ''));

  const cogsByOrder = new Map<string, number>();
  const ids = orders.map(o => o.id);
  if (ids.length) {
    // Vendor COGS, the snapshot recorded when each order was dispatched.
    // Also paged: with >1000 in-window orders the settlement rows can exceed
    // the PostgREST cap too, which silently zeroed COGS for the excess orders.
    const { data: settle } = await fetchAll<{ order_id: string; vendor_cost: number | null }>(
      admin.from('vendor_settlements').select('order_id, vendor_cost').in('order_id', ids).order('order_id', { ascending: true }),
    );
    const set = new Set(ids);
    for (const s of settle ?? []) {
      if (set.has(s.order_id)) cogsByOrder.set(s.order_id, (cogsByOrder.get(s.order_id) ?? 0) + Number(s.vendor_cost ?? 0));
    }

    // Own-stock COGS, acquisition cost of every line whose product isn't
    // vendor-sourced (vendor lines are already covered above).
    const productIds = new Set<string>();
    for (const o of orders) for (const it of o.items ?? []) if (it?.id) productIds.add(it.id);
    if (productIds.size) {
      const { data: prods } = await fetchAll<{ id: string; vendor_id: string | null; cost_price: number | null }>(
        admin
          .from('products')
          .select('id, vendor_id, cost_price')
          .in('id', [...productIds])
          .order('id', { ascending: true }),
      );
      const costMap = new Map(
        (prods ?? []).map(p => [p.id, { vendorId: p.vendor_id, cost: Number(p.cost_price ?? 0) }]),
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

  // Per-order acquisition cost (auto-filled at dispatch by the shared cost
  // engine, or staff-entered) overrides the computed vendor+own-stock
  // estimate — drop-ship prices vary per order.
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
