// ============================================================================
// Shared TCS delivery-cost reconciliation.
//
// Pulls TCS's billing ledger (Payment Detail API) for a date window and writes
// the ACTUAL courier charge onto each matching order's `delivery_cost`, so the
// Finance shipping-margin figures run on real costs instead of the typical-cost
// estimate. TCS bills for failed/return legs too, so refused/returned orders
// get their real loss recorded here as well. (The spec's ledger payload has no
// separate GST field; `rec.gst` is kept as a defensive add in case TCS breaks
// it out on some accounts — delivery_cost holds the all-in billed figure.)
//
// Extracted so BOTH the on-demand admin action (Finance → "Sync actual delivery
// costs") and the daily cron can share one implementation. Takes a Supabase
// client (service-role in the cron, supabaseAdmin() in the action) rather than
// creating its own. Best-effort and side-effect-free beyond the order updates,
// the per-order audit rows, and the last-synced stamp in site_settings.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdapter } from '@/lib/couriers';
import { logAudit } from '@/lib/audit';
import type { StaffSession } from '@/lib/permissions';

export interface ReconcileCostsResult {
  ok: boolean;
  message?: string;
  scanned: number;
  matched: number;
  updated: number;
  /** Orders whose delivery_cost actually changed, for the UI/audit trail. */
  changes: Array<{ orderNumber: string | null; from: number | null; to: number }>;
}

/** site_settings key holding the last SUCCESSFUL reconcile run (JSON:
 *  { at, scanned, matched, updated, source }) — read by the Finance page's
 *  "Costs last synced" line. Written on every ok run, button or cron. */
export const COST_SYNC_STAMP_KEY = 'tcs_cost_sync_last';

interface MatchedOrder {
  id: string;
  order_number: string | null;
  delivery_cost: number | null;
  courier_paid_at: string | null;
  vendor_id: string | null;
  vendors: { self_delivers: boolean | null } | Array<{ self_delivers: boolean | null }> | null;
}

const selfDelivers = (o: MatchedOrder): boolean => {
  const v = Array.isArray(o.vendors) ? o.vendors[0] : o.vendors;
  return v?.self_delivers === true;
};

export async function reconcileTcsCosts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: SupabaseClient<any, any, any>,
  days = 30,
  session: StaffSession | null = null,
): Promise<ReconcileCostsResult> {
  const adapter = getAdapter('TCS');
  const empty = { scanned: 0, matched: 0, updated: 0, changes: [] };
  if (!adapter?.payment) {
    return { ok: false, message: 'TCS payment reconciliation unavailable — set TCS_CUSTOMER_NO (and the TCS API keys).', ...empty };
  }

  const d = Math.min(180, Math.max(1, days));
  const fmtDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const now = new Date().getTime();

  // TCS caps Payment Detail at 31 days per request ("Date Range should be
  // whithin 31 Days" — their spelling; verified live 2026-08-09, first
  // successful sync). Slice the requested look-back into ≤30-day windows and
  // merge the ledgers; a CN's billed charge is the same whichever window
  // returns it, so overlap at the boundaries is harmless.
  const WINDOW_DAYS = 30;
  const costByCn = new Map<string, number>();
  const paidByCn = new Map<string, { at: string | null; amount: number | null }>();
  let scanned = 0;
  for (let offset = 0; offset < d; offset += WINDOW_DAYS) {
    const winEndMs = now - offset * 86_400_000;
    const winStartMs = now - Math.min(d, offset + WINDOW_DAYS) * 86_400_000;
    const res = await adapter.payment(fmtDate(winStartMs), fmtDate(winEndMs));
    if (!('ok' in res) || !res.ok) {
      return { ok: false, message: `${res.message} (window ${fmtDate(winStartMs)} to ${fmtDate(winEndMs)})`, ...empty };
    }
    scanned += res.records.length;
    // Cost per CN from the ledger. The ledger is merchant-wide (keyed only
    // by customer number + dates), so resolve all CNs in bulk instead of a
    // per-record round trip.
    for (const rec of res.records) {
      if (!rec.trackingNumber) continue;
      if (rec.deliveryCharges != null) {
        costByCn.set(rec.trackingNumber, Math.round(rec.deliveryCharges + (rec.gst ?? 0)));
      }
      // The same ledger row says whether TCS has remitted the COD cash.
      // Recorded as the courier's CLAIM (orders.courier_paid_at/_amount) so
      // the COD tab can show "TCS says paid out" — never as
      // payment_received_at, which stays the owner's manual bank-statement
      // confirmation.
      if (rec.paid) {
        paidByCn.set(rec.trackingNumber, { at: rec.paidAt ?? rec.deliveredAt, amount: rec.amountPaid });
      }
    }
  }

  const orderSelect = 'id, order_number, delivery_cost, courier_paid_at, vendor_id, vendors(self_delivers)';
  const byId = new Map<string, MatchedOrder>();
  const cns = [...new Set([...costByCn.keys(), ...paidByCn.keys()])];
  const cnForOrder = new Map<string, string>();
  const CHUNK = 200;
  for (let i = 0; i < cns.length; i += CHUNK) {
    const chunk = cns.slice(i, i + CHUNK);
    // Primary match: orders.tracking_number (partial index, migration 950).
    const { data: direct } = await sb
      .from('orders')
      .select(`${orderSelect}, tracking_number`)
      .in('tracking_number', chunk)
      .is('archived_at', null);
    for (const o of (direct ?? []) as Array<MatchedOrder & { tracking_number: string }>) {
      byId.set(o.id, o);
      cnForOrder.set(o.id, o.tracking_number);
    }
    // Fallback: the CN may live only on shipments.tracking_number (e.g. after
    // a "Fix tracking number" repair that the order row didn't mirror).
    const { data: viaShip } = await sb
      .from('shipments')
      .select('tracking_number, orders!inner(id, order_number, delivery_cost, courier_paid_at, vendor_id, archived_at, vendors(self_delivers))')
      .in('tracking_number', chunk)
      .is('orders.archived_at', null);
    for (const s of (viaShip ?? []) as Array<{ tracking_number: string; orders: MatchedOrder | MatchedOrder[] }>) {
      const ords = Array.isArray(s.orders) ? s.orders : [s.orders];
      for (const o of ords) {
        if (o && !byId.has(o.id)) {
          byId.set(o.id, o);
          cnForOrder.set(o.id, s.tracking_number);
        }
      }
    }
  }

  let matched = 0;
  let updated = 0;
  const changes: ReconcileCostsResult['changes'] = [];
  // Group updates by target cost so a duplicated CN (two orders sharing one
  // number after a tracking repair) updates BOTH rows, and the write count
  // stays one query per distinct cost rather than one per order.
  const idsByCost = new Map<number, Array<MatchedOrder>>();
  for (const o of byId.values()) {
    const cn = cnForOrder.get(o.id);
    // Self-delivering vendors ship on their own courier and eat the charge —
    // a ledger CN matching one of their orders must never write a cost the
    // store doesn't pay (their delivery_cost is deliberately pinned at
    // dispatch, usually 0), and their COD never reaches TCS's payout either.
    if (selfDelivers(o)) continue;
    // Record TCS's payout claim once (first sync that sees paid='Y' wins;
    // the claim doesn't change afterwards).
    const paid = cn != null ? paidByCn.get(cn) : undefined;
    if (paid && o.courier_paid_at == null) {
      await sb.from('orders')
        .update({ courier_paid_at: paid.at ?? new Date().toISOString(), courier_paid_amount: paid.amount })
        .eq('id', o.id);
    }
    const cost = cn != null ? costByCn.get(cn) : undefined;
    if (cost == null) continue;
    matched++;
    const current = o.delivery_cost == null ? null : Number(o.delivery_cost);
    if (current === cost) continue;
    const list = idsByCost.get(cost) ?? [];
    list.push(o);
    idsByCost.set(cost, list);
  }
  for (const [cost, ords] of idsByCost) {
    const { error } = await sb.from('orders').update({ delivery_cost: cost }).in('id', ords.map(o => o.id));
    if (error) continue;
    updated += ords.length;
    for (const o of ords) {
      const from = o.delivery_cost == null ? null : Number(o.delivery_cost);
      changes.push({ orderNumber: o.order_number, from, to: cost });
      // One audit row per changed order: reconcile intentionally overwrites
      // hand-keyed values when TCS's billed figure differs, and that swap
      // should be visible per order, not silent.
      void logAudit(session, {
        action: 'order.reconcile_delivery_cost',
        entity: 'orders',
        entity_id: o.id,
        diff: { courier: 'TCS', cn: cnForOrder.get(o.id), delivery_cost: { from, to: cost } },
      });
    }
  }

  // Durable success stamp for the Finance page's "Costs last synced" line —
  // covers both the button and cron paths.
  await sb.from('site_settings').upsert({
    key: COST_SYNC_STAMP_KEY,
    value: JSON.stringify({ at: new Date().toISOString(), scanned, matched, updated, source: session ? 'button' : 'cron' }),
  }, { onConflict: 'key' });

  return { ok: true, scanned, matched, updated, changes };
}
