// Shared finance helpers used by the admin Finance page and its CSV export
// route, so the per-order money maths lives in exactly one place.
import { supabaseAdmin } from './supabase';
import { fetchAll } from './fetch-all';

export interface FinanceRange {
  key: string;
  label: string;
  /** Rolling-window length; null for calendar/all ranges. */
  days: number | null;
  /** Calendar-aligned ranges start at a Pakistan-time boundary (store's
   *  market runs on PKT): 'day' = since PKT midnight, 'month' = since the
   *  1st of the current PKT month. */
  calendar?: 'day' | 'month';
}

export const FINANCE_RANGES: FinanceRange[] = [
  { key: 'today', label: 'Today', days: 1, calendar: 'day' },
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: 'month', label: 'This month', days: null, calendar: 'month' },
  { key: 'all', label: 'All time', days: null },
];

/** Asia/Karachi is a fixed UTC+5 (no DST) — same constant as order-range.ts. */
export const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

// Canonical pay-method labels moved to @/types (PAY_METHOD_LABELS) so client
// components can share them; import from there.

// Orders in these states never count as revenue. Matches the Analytics
// revenue view (migration 023 v_orders_revenue): `payment_pending` orders
// are unpaid — the gateway never confirmed — so counting them inflated the
// "Revenue (paid orders)" P&L line.
//
// Intentional difference from v_orders_revenue on COUNT (not revenue): that
// view keeps `refunded` and `returned` rows with revenue zeroed (migration
// 830), so the dashboard/Analytics order count includes them as *placed*
// orders; the P&L here drops them entirely because they contribute no
// revenue line (returned orders DO surface their courier cost via the sunk
// return-cost block below). Revenue is identical either way (both → 0);
// the two surfaces answer different questions — "orders placed" (dashboard)
// vs "orders that produced P&L" (finance) — so their order counts can
// differ by the number of refunds/returns. Keep both rules here so they
// don't silently drift.
const DEAD_STATES = new Set(['cancelled', 'payment_failed', 'payment_pending', 'refunded', 'returned']);

/** Orders that reached the customer's door but came back — refused on COD, or
 *  returned to origin. These earn NO revenue (nothing was collected) yet still
 *  cost us the courier's round-trip charge, so they're a pure delivery loss the
 *  P&L must surface rather than hide. Kept separate from DEAD_STATES so the
 *  Finance page can total that loss on its own. */
export const RETURNED_STATES = new Set(['returned']);

/** Sum the courier cost sunk on returned/refused orders in the window — real
 *  loss (delivery charged by the courier for the failed round trip, zero
 *  revenue). Falls back to the owner's typical-delivery-cost estimate when an
 *  order has no exact recorded charge yet. Also totals the payment fees sunk
 *  on those orders (a gateway fee on a returned order is a real cost that no
 *  other line counts). `estimatedCount` says how many of the losses are the
 *  estimate rather than a recorded charge; `vendorDeliveredCount` how many
 *  are a genuine zero because a self-delivering vendor eats the courier
 *  charge (their delivery_cost is pinned at dispatch, usually 0). */
export async function loadReturnedDeliveryLoss(
  fromISO: string | null,
  defaultDeliveryCost: number,
): Promise<{ count: number; loss: number; fees: number; estimatedCount: number; vendorDeliveredCount: number }> {
  const admin = supabaseAdmin();
  let q = admin.from('orders')
    .select('delivery_cost, payment_fee, status, vendor_id, vendors(self_delivers)')
    .in('status', [...RETURNED_STATES]).is('archived_at', null);
  if (fromISO) q = q.gte('created_at', fromISO);
  type Row = {
    delivery_cost: number | null; payment_fee: number | null; status: string | null;
    vendor_id: string | null;
    vendors: { self_delivers: boolean | null } | Array<{ self_delivers: boolean | null }> | null;
  };
  const { data } = await fetchAll<Row>(q);
  const rows = data ?? [];
  let loss = 0; let fees = 0; let estimatedCount = 0; let vendorDeliveredCount = 0;
  for (const o of rows) {
    const v = Array.isArray(o.vendors) ? o.vendors[0] : o.vendors;
    if (o.delivery_cost != null) {
      loss += Number(o.delivery_cost) || 0;
      if ((Number(o.delivery_cost) || 0) === 0 && v?.self_delivers === true) vendorDeliveredCount++;
    } else if (v?.self_delivers === true) {
      // Vendor ships on its own courier — no store-side charge to estimate.
      vendorDeliveredCount++;
    } else {
      loss += defaultDeliveryCost;
      if (defaultDeliveryCost > 0) estimatedCount++;
    }
    fees += Number(o.payment_fee) || 0;
  }
  return { count: rows.length, loss, fees, estimatedCount, vendorDeliveredCount };
}

export const fnum = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

export function resolveRange(key?: string) {
  return FINANCE_RANGES.find(r => r.key === key)
    ?? FINANCE_RANGES.find(r => r.key === '30d')!; // default 30d
}

/** Window start for a range as an ISO timestamp, or null for "all time".
 *  Rolling ranges are now-minus-N-days; calendar ranges snap to the PKT day/
 *  month boundary. Shared by the Finance page AND its CSV export so the two
 *  can never disagree on what a chip means. Uses `new Date()` (not
 *  Date.now()), the react-hooks purity lint rejects Date.now() in render. */
export function rangeStartISO(range: FinanceRange): string | null {
  const now = new Date().getTime();
  if (range.calendar === 'day') {
    const startOfPktDayUtc = Math.floor((now + PKT_OFFSET_MS) / 86_400_000) * 86_400_000 - PKT_OFFSET_MS;
    return new Date(startOfPktDayUtc).toISOString();
  }
  if (range.calendar === 'month') {
    const pkt = new Date(now + PKT_OFFSET_MS);
    return new Date(Date.UTC(pkt.getUTCFullYear(), pkt.getUTCMonth(), 1) - PKT_OFFSET_MS).toISOString();
  }
  return range.days ? new Date(now - range.days * 86_400_000).toISOString() : null;
}

export interface FinanceOrder {
  id: string; order_number: string | null; created_at: string | null; pay_method: string | null;
  total: number | null; shipping: number | null; delivery_cost: number | null; payment_fee: number | null;
  utm_source: string | null; status: string | null;
  payment_account: string | null; payment_received_at: string | null;
  acquisition_cost: number | null;
  vendor_id: string | null;
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
  let oq = admin.from('orders').select('id, order_number, created_at, pay_method, total, shipping, delivery_cost, payment_fee, utm_source, status, payment_account, payment_received_at, acquisition_cost, vendor_id, items').is('archived_at', null);
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
      const { data: prods } = await fetchAll<{ id: string; vendor_id: string | null; cost_price: number | null; vendor_cost: number | null }>(
        admin
          .from('products')
          .select('id, vendor_id, cost_price, vendor_cost')
          .in('id', [...productIds])
          .order('id', { ascending: true }),
      );
      const costMap = new Map(
        (prods ?? []).map(p => [p.id, { vendorId: p.vendor_id, cost: Number(p.cost_price ?? 0), vendorCost: Number(p.vendor_cost ?? 0) }]),
      );
      // Orders that already have a settlement snapshot: their vendor lines
      // are covered above and must not double-count here.
      const settled = new Set(cogsByOrder.keys());
      for (const o of orders) {
        let own = 0;
        for (const it of o.items ?? []) {
          const p = it?.id ? costMap.get(it.id) : undefined;
          if (!p) continue;
          if (p.vendorId == null && p.cost > 0) own += p.cost * (Number(it.qty) || 0);
          // Vendor-sourced item on an order that was never dispatched (no
          // settlement row): fall back to the product's fixed vendor price —
          // the same basis the COGS nudge accepts as "handled", which used
          // to read as 100% margin here (2026-08-01 audit split-brain).
          else if (p.vendorId != null && !settled.has(o.id) && p.vendorCost > 0) own += p.vendorCost * (Number(it.qty) || 0);
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
  /** null = no cost recorded ANYWHERE for this order (no acquisition cost, no
   *  settlement, no product cost_price) — distinct from a genuine 0. The UI
   *  renders "—" instead of a fabricated 100% margin. */
  cogs: number | null;
  total: number; delivery: number; fee: number; costs: number;
  gross: number;
  /** null when cogs is unknown — a margin computed without COGS is fiction. */
  margin: number | null;
  payment_account: string | null; payment_received_at: string | null;
}

/** Per-order P&L row: total minus the costs recorded for that order. */
export function toOrderFinanceRow(o: FinanceOrder, cogsByOrder: Map<string, number>): OrderFinanceRow {
  const cogs = cogsByOrder.get(o.id) ?? null;
  const delivery = fnum(o.delivery_cost);
  const fee = fnum(o.payment_fee);
  const total = fnum(o.total);
  const costs = (cogs ?? 0) + delivery + fee;
  const gross = total - costs;
  return {
    id: o.id, order_number: o.order_number, created_at: o.created_at, method: o.pay_method ?? 'unknown',
    total, cogs, delivery, fee, costs, gross,
    margin: cogs == null ? null : total > 0 ? (gross / total) * 100 : 0,
    payment_account: o.payment_account, payment_received_at: o.payment_received_at,
  };
}
