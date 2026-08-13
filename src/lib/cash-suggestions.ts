// Suggested cash entries: movements already recorded elsewhere in the admin
// that imply real money moving, proposed to the cashbook for one-tap
// confirmation. The books stay separate — nothing is written until a human
// confirms — but the Cash page stops relying on memory.
//
// Sources:
//   • vendor_settlements with status='settled', grouped per vendor per day
//     per direction (Vendors → "Settle all" clears a batch in one transfer):
//     due_to='vendor' → we paid them → vendor_payout (out)
//     due_to='us'     → they paid us → vendor_receipt (in)
//   • payments with status='succeeded' on real money gateways (bank, wallet,
//     manual reconciliation) → online_payment (in). COD stays manual: the
//     courier remits in lumps on their own schedule, which only the owner
//     sees, so proposing per-order rows would be wrong.
//
// A suggestion disappears once its source_key exists on a cash entry
// (confirmed) or in cash_suggestion_skips (dismissed).

import type { SupabaseClient } from '@supabase/supabase-js';

export interface CashSuggestion {
  sourceKey: string;
  category: 'vendor_payout' | 'vendor_receipt' | 'online_payment';
  amount: number;
  /** YYYY-MM-DD the money moved. */
  date: string;
  label: string;
}

const WINDOW_DAYS = 90;
const MAX_SUGGESTIONS = 20;

export async function loadCashSuggestions(admin: SupabaseClient): Promise<CashSuggestion[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: settleRows }, { data: paymentRows }, { data: usedRows }, { data: skipRows }] = await Promise.all([
    admin
      .from('vendor_settlements')
      .select('vendor_id, amount_due, due_to, settled_at, vendors(name)')
      .eq('status', 'settled')
      .gte('settled_at', since),
    admin
      .from('payments')
      .select('id, amount, gateway, created_at, orders(order_number)')
      .eq('status', 'succeeded')
      .in('gateway', ['bank', 'manual', 'jazzcash', 'easypaisa'])
      .gte('created_at', since),
    admin.from('cash_entries').select('source_key').not('source_key', 'is', null),
    admin.from('cash_suggestion_skips').select('source_key'),
  ]);

  const seen = new Set<string>([
    ...((usedRows ?? []) as Array<{ source_key: string }>).map(r => r.source_key),
    ...((skipRows ?? []) as Array<{ source_key: string }>).map(r => r.source_key),
  ]);

  const suggestions: CashSuggestion[] = [];

  // Settlements: one suggestion per vendor per settle-day per direction —
  // "Settle all" is one bank transfer, so one cash movement.
  const groups = new Map<string, { amount: number; count: number; vendor: string; date: string; dueTo: 'us' | 'vendor' }>();
  for (const r of (settleRows ?? []) as Array<{
    vendor_id: string; amount_due: number; due_to: 'us' | 'vendor'; settled_at: string | null;
    vendors: { name: string } | { name: string }[] | null;
  }>) {
    if (!r.settled_at || !(Number(r.amount_due) > 0)) continue;
    const date = r.settled_at.slice(0, 10);
    const key = `settle:${r.vendor_id}:${date}:${r.due_to}`;
    const vendorName = (Array.isArray(r.vendors) ? r.vendors[0]?.name : r.vendors?.name) ?? 'vendor';
    const g = groups.get(key) ?? { amount: 0, count: 0, vendor: vendorName, date, dueTo: r.due_to };
    g.amount += Number(r.amount_due);
    g.count += 1;
    groups.set(key, g);
  }
  for (const [key, g] of groups) {
    if (seen.has(key)) continue;
    suggestions.push({
      sourceKey: key,
      category: g.dueTo === 'vendor' ? 'vendor_payout' : 'vendor_receipt',
      amount: Math.round(g.amount),
      date: g.date,
      label: g.dueTo === 'vendor'
        ? `Paid ${g.vendor} (${g.count} settled order${g.count === 1 ? '' : 's'})`
        : `${g.vendor} paid us (${g.count} settled order${g.count === 1 ? '' : 's'})`,
    });
  }

  for (const p of (paymentRows ?? []) as Array<{
    id: string; amount: number; gateway: string; created_at: string;
    orders: { order_number: string } | { order_number: string }[] | null;
  }>) {
    const key = `payment:${p.id}`;
    if (seen.has(key) || !(Number(p.amount) > 0)) continue;
    const orderNo = (Array.isArray(p.orders) ? p.orders[0]?.order_number : p.orders?.order_number) ?? 'order';
    suggestions.push({
      sourceKey: key,
      category: 'online_payment',
      amount: Math.round(Number(p.amount)),
      date: p.created_at.slice(0, 10),
      label: `${p.gateway === 'bank' ? 'Bank transfer' : p.gateway === 'manual' ? 'Payment' : p.gateway} for ${orderNo}`,
    });
  }

  suggestions.sort((a, b) => b.date.localeCompare(a.date));
  return suggestions.slice(0, MAX_SUGGESTIONS);
}
