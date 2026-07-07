// ============================================================================
// Shared TCS delivery-cost reconciliation.
//
// Pulls TCS's billing ledger (Payment Detail API) for a date window and writes
// the ACTUAL courier charge (delivery charge + GST) onto each matching order's
// `delivery_cost`, so the Finance shipping-margin figures run on real costs
// instead of the typical-cost estimate. TCS bills for failed/return legs too,
// so refused/returned orders get their real loss recorded here as well.
//
// Extracted so BOTH the on-demand admin action (Finance → "Sync actual delivery
// costs") and the daily cron can share one implementation. Takes a Supabase
// client (service-role in the cron, supabaseAdmin() in the action) rather than
// creating its own. Best-effort and side-effect-free beyond the order updates.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdapter } from '@/lib/couriers';

export interface ReconcileCostsResult {
  ok: boolean;
  message?: string;
  scanned: number;
  matched: number;
  updated: number;
}

export async function reconcileTcsCosts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: SupabaseClient<any, any, any>,
  days = 30,
): Promise<ReconcileCostsResult> {
  const adapter = getAdapter('TCS');
  if (!adapter || !adapter.payment) {
    return {
      ok: false,
      message: 'TCS payment reconciliation unavailable — set TCS_CUSTOMER_NO (and the TCS API keys).',
      scanned: 0, matched: 0, updated: 0,
    };
  }

  const d = Math.min(180, Math.max(1, days));
  const fmtDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const now = new Date().getTime();
  const res = await adapter.payment(fmtDate(now - d * 86_400_000), fmtDate(now));
  if (!('ok' in res) || !res.ok) {
    return { ok: false, message: res.message, scanned: 0, matched: 0, updated: 0 };
  }

  let matched = 0;
  let updated = 0;
  for (const rec of res.records) {
    if (!rec.trackingNumber || rec.deliveryCharges == null) continue;
    // The real cost to us is the courier charge plus GST on it.
    const cost = Math.round(rec.deliveryCharges + (rec.gst ?? 0));
    const { data: ord } = await sb
      .from('orders')
      .select('id, delivery_cost')
      .eq('tracking_number', rec.trackingNumber)
      .maybeSingle();
    if (!ord) continue;
    matched++;
    if (Number((ord as { delivery_cost: number | null }).delivery_cost ?? NaN) === cost) continue;
    const { error } = await sb.from('orders').update({ delivery_cost: cost }).eq('id', (ord as { id: string }).id);
    if (!error) updated++;
  }

  return { ok: true, scanned: res.records.length, matched, updated };
}
