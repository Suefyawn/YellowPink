// ============================================================================
// Order next-step nudges. Runs inside the consolidated daily cron queue
// (api/cron/daily) — evaluates every active order against the pure rules in
// lib/order-actions.ts and posts ONE admin notification per outstanding step
// per order, ever (deduped on entity_id). The bell shows it immediately and
// the migration-370 fanout pushes it to subscribed staff phones, so the
// workflow's follow-ups (confirm → dispatch → chase delivery → record costs →
// reconcile COD → settle vendor) stop depending on anyone's memory.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { outstandingOrderActions, type OrderActionSnapshot } from '@/lib/order-actions';

export const maxDuration = 30;

// Orders in a terminal state with nothing owed are skipped at the query.
const ACTIVE_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'returned'];
// Delivered/returned orders older than this are left alone: a 60-day-old
// gap is the monthly-review's job, not a daily nag.
const LOOKBACK_DAYS = 45;

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

interface OrderRow {
  id: string; order_number: string; status: string; pay_method: string; vendor_id: string | null;
  vendor_sent_at: string | null; delivery_cost: number | null;
  acquisition_cost: number | null; payment_received_at: string | null;
  updated_at: string | null; created_at: string; confirmed_at: string | null;
  items: Array<{ id?: string | null; qty?: number | null }> | null;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString();
  const { data: orderRows, error } = await sb
    .from('orders')
    .select('id, order_number, status, pay_method, vendor_id, vendor_sent_at, delivery_cost, acquisition_cost, payment_received_at, updated_at, created_at, confirmed_at, items')
    .is('archived_at', null)
    .in('status', ACTIVE_STATUSES)
    .gte('created_at', since)
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const orders = (orderRows ?? []) as OrderRow[];
  if (orders.length === 0) return NextResponse.json({ ok: true, evaluated: 0, notified: 0 });

  const ids = orders.map(o => o.id);
  const [{ data: shipRows }, { data: settleRows }, { data: eventRows }] = await Promise.all([
    sb.from('shipments').select('order_id, status').in('order_id', ids).neq('status', 'cancelled'),
    sb.from('vendor_settlements').select('order_id, status, created_at').in('order_id', ids).eq('status', 'pending'),
    // Latest status-change per order → how long it has sat in its current
    // state. Orders with no event rows (legacy imports) fall back to
    // updated_at, then created_at.
    sb.from('order_events').select('order_id, created_at').in('order_id', ids).order('created_at', { ascending: false }),
  ]);
  const shipped = new Set(((shipRows ?? []) as { order_id: string }[]).map(r => r.order_id));
  const settleAge = new Map<string, number>();
  for (const s of (settleRows ?? []) as { order_id: string; created_at: string }[]) {
    settleAge.set(s.order_id, Math.floor((Date.now() - new Date(s.created_at).getTime()) / 86400_000));
  }
  const lastEvent = new Map<string, string>();
  for (const e of (eventRows ?? []) as { order_id: string; created_at: string }[]) {
    if (!lastEvent.has(e.order_id)) lastEvent.set(e.order_id, e.created_at);
  }

  // Product-level cost bases, so the COGS nudge stays quiet when the owner
  // records costs on the product page instead of per order (Finance derives
  // COGS from cost_price/vendor_cost when acquisition_cost is absent).
  const productIds = Array.from(new Set(
    orders.flatMap(o => (o.items ?? []).map(it => it?.id).filter((v): v is string => Boolean(v))),
  ));
  const { data: prodRows } = productIds.length
    ? await sb.from('products').select('id, cost_price, vendor_cost').in('id', productIds)
    : { data: [] };
  const costBasis = new Map(
    ((prodRows ?? []) as { id: string; cost_price: number | null; vendor_cost: number | null }[])
      .map(p => [p.id, Number(p.cost_price) > 0 || Number(p.vendor_cost) > 0]),
  );
  // Which vendors collect payment themselves — their COD never reaches the
  // store's courier statement, so reconcile nudges skip those orders.
  const orderVendorIds = Array.from(new Set(orders.map(o => o.vendor_id).filter((v): v is string => Boolean(v))));
  const { data: vendorDirRows } = orderVendorIds.length
    ? await sb.from('vendors').select('id, settlement_direction').in('id', orderVendorIds)
    : { data: [] };
  const vendorCollectsSet = new Set(
    ((vendorDirRows ?? []) as { id: string; settlement_direction: string | null }[])
      .filter(v => v.settlement_direction === 'vendor_collects').map(v => v.id),
  );

  const itemsCovered = (o: OrderRow): boolean => {
    const items = o.items ?? [];
    if (items.length === 0) return false;
    return items.every(it => it?.id != null && costBasis.get(it.id) === true);
  };

  let notified = 0;
  const errors: string[] = [];
  for (const o of orders) {
    const enteredAt = lastEvent.get(o.id) ?? o.updated_at ?? o.created_at;
    const snapshot: OrderActionSnapshot = {
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      pay_method: o.pay_method,
      hoursInStatus: Math.max(0, (Date.now() - new Date(enteredAt).getTime()) / 3_600_000),
      hasShipment: shipped.has(o.id),
      vendorDispatched: o.vendor_sent_at != null,
      hoursSinceVendorDispatch: o.vendor_sent_at != null
        ? Math.max(0, (Date.now() - new Date(o.vendor_sent_at).getTime()) / 3_600_000)
        : null,
      hasDeliveryCost: o.delivery_cost != null,
      hasAcquisitionCost: o.acquisition_cost != null,
      paymentReconciled: o.payment_received_at != null,
      pendingSettlementDays: settleAge.get(o.id) ?? null,
      confirmedAt: o.confirmed_at,
      itemsHaveCostBasis: itemsCovered(o),
      vendorCollectsPayment: o.vendor_id != null && vendorCollectsSet.has(o.vendor_id),
    };
    for (const act of outstandingOrderActions(snapshot)) {
      const dedupKey = `order_action:${o.id}:${act.key}`;
      try {
        const { data: existing } = await sb
          .from('admin_notifications').select('id').eq('entity_id', dedupKey).limit(1);
        if (existing && existing.length > 0) continue;
        const { error: insErr } = await sb.from('admin_notifications').insert({
          kind: 'order_action',
          title: act.title,
          body: act.body,
          link: `/admin/orders/${o.id}`,
          entity_id: dedupKey,
        });
        if (insErr) errors.push(`${dedupKey}: ${insErr.message}`);
        else notified++;
      } catch (err) {
        errors.push(`${dedupKey}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return NextResponse.json({ ok: true, evaluated: orders.length, notified, errors });
}
