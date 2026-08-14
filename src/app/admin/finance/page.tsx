export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Link from 'next/link';
import { supabaseAdmin, getSiteSettings } from '@/lib/supabase';
import { parseCommerceConfig } from '@/lib/commerce';
import { configuredAdapterIds, getAdapter } from '@/lib/couriers';
import { COST_SYNC_STAMP_KEY } from '@/lib/couriers/reconcile-costs';
import { ReconcileTcsButton } from '@/components/admin/ReconcileTcsButton';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { fmtPKR as fmt } from '@/lib/money';
import { FINANCE_RANGES as RANGES, PKT_OFFSET_MS, resolveRange, rangeStartISO, loadFinanceOrders, loadReturnedDeliveryLoss, toOrderFinanceRow } from '@/lib/finance';
import { PAY_METHOD_LABELS } from '@/types';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { FinanceTabs } from '@/components/admin/FinanceTabs';
import { KpiCard } from '@/components/admin/insights/KpiCard';
import { channelOf } from '@/lib/channels';
import { RangePicker } from '@/components/admin/insights/RangePicker';
import { InsightCallouts } from '@/components/admin/insights/InsightCallouts';
import { addExpense, deleteExpense } from './actions';
import { fmtDatePK as fmtDate } from '@/lib/dates';

const EXPENSE_CATEGORIES = ['Ads', 'Salaries', 'Packaging', 'Marketing', 'Rent & Utilities', 'Other'];
const AD_CHANNELS = ['Meta', 'Instagram', 'Facebook', 'Google', 'TikTok', 'Other'];

interface ExpenseRow { id: string; incurred_on: string; category: string; channel: string | null; amount: number | string; note: string | null; }

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; method?: string; err?: string; ok?: string; costs?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('finance'))) {
    return <NoAccess section="Finance" />;
  }

  const { range: rangeParam, method: methodParam, err, ok } = await searchParams;
  const range = resolveRange(rangeParam);
  const fromISO = rangeStartISO(range);
  // Expenses are date-only (incurred_on) and PKT-dated: convert the window
  // boundary to its PKT calendar date. A naive UTC slice of a PKT-midnight
  // boundary is 19:00Z of the PREVIOUS day, which leaked the prior day's
  // expenses into "Today".
  const fromDay = fromISO ? new Date(new Date(fromISO).getTime() + PKT_OFFSET_MS).toISOString().slice(0, 10) : null;
  // Optional payment-method filter for the per-order table + CSV export.
  const methodFilter = methodParam && PAY_METHOD_LABELS[methodParam] ? methodParam : null;

  const admin = supabaseAdmin();

  // Revenue-eligible orders + per-order COGS (shared with the export route).
  const { orders, cogsByOrder } = await loadFinanceOrders(fromISO);
  const cogs = [...cogsByOrder.values()].reduce((s, v) => s + v, 0);

  // Vendors whose orders settle vendor-side — resolved BEFORE the aggregates:
  // a vendor that ships on its own courier must not pick up the store's
  // typical-delivery estimate (the vendor pays that courier, not us), and the
  // same orders bucket differently in the account view below.
  const vendorIds = Array.from(new Set(orders.map(o => o.vendor_id).filter((v): v is string => Boolean(v))));
  const { data: finVendors } = vendorIds.length
    ? await admin.from('vendors').select('id, settlement_direction').in('id', vendorIds)
    : { data: [] };
  const vendorCollectsIds = new Set(
    ((finVendors ?? []) as { id: string; settlement_direction: string | null }[])
      .filter(v => v.settlement_direction === 'vendor_collects').map(v => v.id),
  );

  // Operating expenses in range (ad spend + overheads).
  let eq = admin.from('expenses').select('id, incurred_on, category, channel, amount, note');
  if (fromDay) eq = eq.gte('incurred_on', fromDay);
  const { data: expenseData } = await eq.order('incurred_on', { ascending: false });
  const expenses = (expenseData ?? []) as ExpenseRow[];

  // ── Aggregate ──
  const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;
  const siteSettings = await getSiteSettings();
  const defaultDeliveryCost = parseCommerceConfig(siteSettings).defaultDeliveryCost;
  const revenue = orders.reduce((s, o) => s + num(o.total), 0);
  // Booked revenue from orders the customer hasn't confirmed yet ('pending'
  // COD). Surfaced as a memo so a sale-time confirmation backlog doesn't read
  // as done revenue.
  const pendingRevenue = orders.reduce((s, o) => s + (o.status === 'pending' ? num(o.total) : 0), 0);
  // Delivery cost on ONE shared basis for the whole page (the P&L used to
  // count NULL delivery_cost as 0 while the shipping card 40 lines below
  // estimated the same orders at the typical cost — two cards on one screen
  // disagreeing about the same quantity, with net profit overstated). Basis:
  // recorded charge when present; the typical-cost estimate only for
  // store-shipped orders (vendor_collects orders ride the vendor's courier).
  const isVendorCollected = (o: { vendor_id: string | null }) => o.vendor_id != null && vendorCollectsIds.has(o.vendor_id);
  const deliveryCost = orders.reduce(
    (s, o) => s + (o.delivery_cost != null ? num(o.delivery_cost) : isVendorCollected(o) ? 0 : defaultDeliveryCost),
    0,
  );
  const estimatedDeliveryOrders = defaultDeliveryCost > 0
    ? orders.filter(o => o.delivery_cost == null && !isVendorCollected(o)).length
    : 0;
  const paymentFees = orders.reduce((s, o) => s + num(o.payment_fee), 0);
  const grossProfit = revenue - cogs - deliveryCost - paymentFees;
  // Orders with no cost basis recorded anywhere — their margins are unknown,
  // not 100%. Called out under the per-order table.
  const missingCogsOrders = orders.filter(o => !cogsByOrder.has(o.id)).length;

  // ── Shipping recovery ── what we charged customers for delivery vs what the
  // courier costs us, on the same delivery-cost basis as the P&L (the two
  // cards must agree). This makes the flat-rate saving (or the free-shipping
  // subsidy) explicit rather than buried in the P&L.
  const shippingCharged = orders.reduce((s, o) => s + num(o.shipping), 0);
  const shippingDeliveryCost = deliveryCost;
  const shippingNet = shippingCharged - shippingDeliveryCost;
  // Refused / returned-to-origin orders: no revenue was collected but the
  // courier still billed the failed round trip — a pure loss the revenue set
  // above (which now excludes 'returned') no longer sees. Total it separately.
  const returned = await loadReturnedDeliveryLoss(fromISO, defaultDeliveryCost);
  const shippingNetAfterReturns = shippingNet - returned.loss;
  // Returns impact beyond the courier cost: how much booked GMV came back,
  // and what share of parcels that reached a customer bounced. Denominator =
  // orders that reached the door (mirrors the Returns page's rate); this
  // card counts courier RTO / COD refusal by ORDER DATE, the Returns page
  // counts customer return requests — different questions.
  interface ReturnedRow {
    created_at: string | null; total: number | string | null;
    delivery_cost: number | string | null; payment_fee: number | string | null;
    vendor_id: string | null;
    vendors: { self_delivers: boolean | null } | Array<{ self_delivers: boolean | null }> | null;
  }
  let rq = admin.from('orders')
    .select('created_at, total, delivery_cost, payment_fee, vendor_id, vendors(self_delivers)')
    .eq('status', 'returned').is('archived_at', null);
  if (fromISO) rq = rq.gte('created_at', fromISO);
  const { data: returnedRowsData } = await rq;
  const returnedRows = (returnedRowsData ?? []) as ReturnedRow[];
  const returnedGmv = returnedRows.reduce((s, o) => s + num(o.total), 0);
  let cq = admin.from('orders').select('id', { count: 'exact', head: true })
    .in('status', ['delivered', 'returned', 'refunded']).is('archived_at', null);
  if (fromISO) cq = cq.gte('created_at', fromISO);
  const { count: reachedCount } = await cq;
  const returnRate = reachedCount && reachedCount > 0 ? (returnedRows.length / reachedCount) * 100 : null;
  // Payment fees sunk on returned orders are equally real (a gateway fee on a
  // refused parcel is money gone) — deducted with the courier loss below.
  const returnedTotalLoss = returned.loss + returned.fees;

  const expByCat = new Map<string, number>();
  let adSpend = 0;
  const adByChannel = new Map<string, number>();
  for (const e of expenses) {
    const amt = num(e.amount);
    // Match categories case-insensitively: rows imported or written with a
    // different casing ("ads") previously fell out of the Ads bucket, showing
    // Ad spend PKR 0 / ROAS "—" despite logged spend. Normalise to the
    // canonical label so the P&L groups them under one line too.
    const category = EXPENSE_CATEGORIES.find(c => c.toLowerCase() === (e.category ?? '').trim().toLowerCase()) ?? e.category;
    expByCat.set(category, (expByCat.get(category) ?? 0) + amt);
    // Ad spend = the 'Ads' category OR a 'Marketing' expense tagged with a
    // channel (Meta, Facebook, Google…). Marketing spend logged against a
    // channel is real ad money; counting only 'Ads' left it out of Ad
    // spend / ROAS while it still showed in the P&L, so the two disagreed.
    const isAdSpend = category === 'Ads' || (category === 'Marketing' && !!(e.channel && e.channel.trim()));
    if (isAdSpend) {
      adSpend += amt;
      const ch = e.channel || 'Other';
      adByChannel.set(ch, (adByChannel.get(ch) ?? 0) + amt);
    }
  }
  const totalOpex = [...expByCat.values()].reduce((s, v) => s + v, 0);
  // Net profit deducts the returned-delivery loss (courier round trip + sunk
  // payment fees) — it used to be displayed on the shipping card but never
  // actually subtracted, so every return silently flattered the bottom line.
  const netProfit = grossProfit - returnedTotalLoss - totalOpex;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  // ROAS, revenue attributable to a paid source (orders carrying a utm_source).
  // Grouped by the shared channel mapping (src/lib/channels.ts) instead of the
  // raw utm_source string, so "fb", "facebook" and "facebook.com" roll up to
  // one "Facebook" row and this table agrees with Analytics → Sources.
  const bySource = new Map<string, { revenue: number; orders: number }>();
  for (const o of orders) {
    if (!o.utm_source) continue;
    const ch = channelOf({ utm_source: o.utm_source });
    const cur = bySource.get(ch) ?? { revenue: 0, orders: 0 };
    cur.revenue += num(o.total); cur.orders += 1;
    bySource.set(ch, cur);
  }
  const attributedRevenue = [...bySource.values()].reduce((s, v) => s + v.revenue, 0);
  const blendedRoas = adSpend > 0 ? attributedRevenue / adSpend : null;

  // Revenue & profit grouped by payment method. "Gross" here is after the
  // per-order costs (COGS + delivery + fees) but before shared overheads
  // (ads, salaries, rent…), which aren't attributable to a single method.
  const byMethod = new Map<string, { orders: number; revenue: number; delivery: number; fees: number; cogs: number }>();
  for (const o of orders) {
    const m = o.pay_method ?? 'unknown';
    const cur = byMethod.get(m) ?? { orders: 0, revenue: 0, delivery: 0, fees: 0, cogs: 0 };
    cur.orders += 1;
    cur.revenue += num(o.total);
    cur.delivery += num(o.delivery_cost);
    cur.fees += num(o.payment_fee);
    cur.cogs += cogsByOrder.get(o.id) ?? 0;
    byMethod.set(m, cur);
  }
  const methodRows = [...byMethod.entries()].map(([method, v]) => {
    const costs = v.cogs + v.delivery + v.fees;
    const gross = v.revenue - costs;
    return { method, orders: v.orders, revenue: v.revenue, costs, gross, margin: v.revenue > 0 ? (gross / v.revenue) * 100 : 0 };
  }).sort((a, b) => b.revenue - a.revenue);

  // Revenue grouped by the account staff reconciled the payment into. Orders
  // with no recorded payment fall into "Unrecorded". `awaiting` counts non-COD
  // orders still missing a recorded payment, the reconciliation to-do.
  const byAccount = new Map<string, { orders: number; revenue: number }>();
  let awaiting = 0;
  // Booked revenue whose cash hasn't actually landed yet (no recorded payment):
  // COD not-yet-collected + non-COD gateway orders still unconfirmed. Surfaced
  // as a sub-line so "Revenue" isn't misread as money in hand.
  // Vendor-collected COD is NOT store cash-in-flight: the vendor keeps it and
  // the store's share arrives via the Vendors-page settlement, so those
  // orders get their own account bucket instead of inflating "Unrecorded" /
  // not-yet-received forever (2026-08-01 audit). vendorCollectsIds is
  // resolved above, before the aggregates.
  const VENDOR_BUCKET = 'Vendor-collected (settles via Vendors)';
  let notReceivedRevenue = 0;
  for (const o of orders) {
    const vendorCollected = o.vendor_id != null && vendorCollectsIds.has(o.vendor_id);
    if (!o.payment_received_at && !vendorCollected) notReceivedRevenue += num(o.total);
    if (o.pay_method !== 'cod' && !o.payment_received_at && !vendorCollected) awaiting += 1;
    const key = vendorCollected && !o.payment_account?.trim()
      ? VENDOR_BUCKET
      : (o.payment_account?.trim() || 'Unrecorded');
    const cur = byAccount.get(key) ?? { orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += num(o.total);
    byAccount.set(key, cur);
  }
  const accountRows = [...byAccount.entries()]
    .map(([account, v]) => ({ account, orders: v.orders, revenue: v.revenue }))
    .sort((a, b) => (a.account === 'Unrecorded' ? 1 : b.account === 'Unrecorded' ? -1 : b.revenue - a.revenue));

  // Orders still needing reconciliation: non-COD, no recorded payment. Listed
  // (latest first) so staff can action them straight from Finance.
  const awaitingOrders = orders
    .filter(o => o.pay_method !== 'cod' && !o.payment_received_at
      && !(o.vendor_id != null && vendorCollectsIds.has(o.vendor_id)))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

  // Per-order finance rows for the period, optionally narrowed to one payment
  // method, latest first and capped so the table stays readable on long ranges.
  const ORDER_ROW_CAP = 100;
  const methodFilteredOrders = methodFilter ? orders.filter(o => (o.pay_method ?? 'unknown') === methodFilter) : orders;
  const orderRowsTotal = methodFilteredOrders.length;
  const orderRows = [...methodFilteredOrders]
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, ORDER_ROW_CAP)
    .map(o => toOrderFinanceRow(o, cogsByOrder));
  const methodsPresent = [...new Set(orders.map(o => o.pay_method ?? 'unknown'))].sort();
  const orderTableQs = `range=${range.key}${methodFilter ? `&method=${methodFilter}` : ''}`;

  // Daily revenue series for the Revenue KPI sparkline: bucket the already-
  // loaded orders by created-at day, chronological. Fixed ranges keep empty
  // days as zeroes; "all time" spans only the days data is present for.
  const revByDay = new Map<string, number>();
  for (const o of orders) {
    if (!o.created_at) continue;
    const day = o.created_at.slice(0, 10);
    revByDay.set(day, (revByDay.get(day) ?? 0) + num(o.total));
  }
  // Fixed rolling ranges keep empty days as zeroes; calendar ranges (Today /
  // This month) and "all time" span only the days data is present for — their
  // length isn't a constant day count.
  const revenueSpark: number[] = range.days != null && !range.calendar && fromISO
    ? Array.from({ length: range.days }, (_, i) => {
        const day = new Date(new Date(fromISO).getTime() + i * 86_400_000).toISOString().slice(0, 10);
        return revByDay.get(day) ?? 0;
      })
    : [...revByDay.keys()].sort().map(day => revByDay.get(day) ?? 0);

  const card: React.CSSProperties = { background: 'white', borderRadius: 12, padding: 24, border: '1px solid #eef0f2', boxShadow: '0 1px 2px rgba(16,24,40,0.04)' };
  const profitColor = netProfit >= 0 ? '#15803d' : '#dc2626';

  // Cash position for the KPI row: booked revenue not yet in hand, split by
  // where it actually sits. Vendor-held COD is excluded from
  // notReceivedRevenue by design (it settles via Vendors) — surfaced in the
  // hint so that cash isn't invisible on the overview.
  const gatewayAwaitingTotal = awaitingOrders.reduce((s, o) => s + num(o.total), 0);
  const storeCodOutstanding = notReceivedRevenue - gatewayAwaitingTotal;
  const vendorHeldTotal = orders.reduce(
    (s, o) => s + (isVendorCollected(o) && o.status === 'delivered' && !o.payment_received_at ? num(o.total) : 0),
    0,
  );
  // COD-tab badge: delivered store-COD orders awaiting confirmation. Queried
  // all-time (not range-scoped) — the badge is an alert about uncollected
  // cash, and old uncollected cash is MORE alarming, not less.
  const { data: codOutRows } = await admin
    .from('orders')
    .select('id, vendor_id, vendors(settlement_direction)')
    .eq('pay_method', 'cod').eq('status', 'delivered')
    .is('payment_received_at', null).is('archived_at', null);
  const codBadge = ((codOutRows ?? []) as Array<{ vendor_id: string | null; vendors: { settlement_direction: string | null } | Array<{ settlement_direction: string | null }> | null }>)
    .filter(r => {
      const v = Array.isArray(r.vendors) ? r.vendors[0] : r.vendors;
      return v?.settlement_direction !== 'vendor_collects';
    }).length;

  // Vendor receivable: pending settlements owed TO the store. Real money
  // (owed for weeks in the live data) that never appeared on Finance.
  const { data: pendingSettleData } = await admin
    .from('vendor_settlements')
    .select('amount_due, due_to, created_at')
    .eq('status', 'pending');
  const owedToUs = ((pendingSettleData ?? []) as Array<{ amount_due: number | string | null; due_to: string | null; created_at: string | null }>)
    .filter(s => s.due_to === 'us');
  const vendorReceivable = owedToUs.reduce((s, r) => s + num(r.amount_due), 0);
  const vendorReceivableOldestDays = owedToUs.length
    ? Math.floor((new Date().getTime() - Math.min(...owedToUs.map(r => new Date(r.created_at ?? new Date().toISOString()).getTime()))) / 86_400_000)
    : 0;

  // Monthly P&L (All time view only): one pass over the already-loaded
  // orders, bucketed by PKT month — answers "July vs August" without a
  // per-month query. Net here is before overheads (expenses ledger is
  // period-scoped, not month-bucketed).
  const pktMonth = (iso: string | null) => iso ? new Date(new Date(iso).getTime() + PKT_OFFSET_MS).toISOString().slice(0, 7) : null;
  interface MonthRow { month: string; orders: number; revenue: number; cogs: number; delivery: number; fees: number; returnsLoss: number; net: number }
  let monthRows: MonthRow[] = [];
  if (range.key === 'all') {
    const byMonth = new Map<string, MonthRow>();
    const monthRow = (m: string) => {
      const cur = byMonth.get(m) ?? { month: m, orders: 0, revenue: 0, cogs: 0, delivery: 0, fees: 0, returnsLoss: 0, net: 0 };
      byMonth.set(m, cur);
      return cur;
    };
    for (const o of orders) {
      const m = pktMonth(o.created_at);
      if (!m) continue;
      const row = monthRow(m);
      row.orders += 1;
      row.revenue += num(o.total);
      row.cogs += cogsByOrder.get(o.id) ?? 0;
      row.delivery += o.delivery_cost != null ? num(o.delivery_cost) : isVendorCollected(o) ? 0 : defaultDeliveryCost;
      row.fees += num(o.payment_fee);
    }
    for (const o of returnedRows) {
      const m = pktMonth(o.created_at);
      if (!m) continue;
      const row = monthRow(m);
      const v = Array.isArray(o.vendors) ? o.vendors[0] : o.vendors;
      const loss = o.delivery_cost != null ? num(o.delivery_cost) : v?.self_delivers === true ? 0 : defaultDeliveryCost;
      row.returnsLoss += loss + num(o.payment_fee);
    }
    monthRows = [...byMonth.values()]
      .map(r => ({ ...r, net: r.revenue - r.cogs - r.delivery - r.fees - r.returnsLoss }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }

  // TCS cost-sync surface: booking config alone isn't enough — the payment
  // ledger needs its own credential (TCS_CUSTOMER_NO), and the action writes
  // orders, so it also needs the orders-manage permission (finance-only staff
  // used to get an unhandled throw from the button).
  const tcsConfigured = configuredAdapterIds().includes('TCS');
  const tcsAdapter = getAdapter('TCS');
  const tcsPaymentReady = tcsConfigured && (tcsAdapter?.paymentConfigured?.() ?? Boolean(tcsAdapter?.payment));
  const canRunCostSync = session.isOwner || session.permissions.includes('orders.edit');
  interface CostSyncStamp { at: string; scanned: number; matched: number; updated: number }
  let costSyncLast: CostSyncStamp | null = null;
  try {
    const raw = siteSettings[COST_SYNC_STAMP_KEY];
    if (raw) costSyncLast = JSON.parse(raw) as CostSyncStamp;
  } catch { costSyncLast = null; }

  // "What stands out" strip, computed only from values already loaded above.
  const financeInsights: string[] = [];
  if (revenue > 0) {
    financeInsights.push(`Net margin is ${margin.toFixed(1)}% — you keep PKR ${Math.round(margin)} of every PKR 100 sold.`);
  }
  if (blendedRoas != null) {
    financeInsights.push(`Tagged ad revenue is ${blendedRoas.toFixed(2)}× ad spend.`);
  }
  if (awaiting > 0) {
    const awaitingTotal = awaitingOrders.reduce((s, o) => s + num(o.total), 0);
    financeInsights.push(`${awaiting} non-COD order${awaiting === 1 ? '' : 's'} (${fmt(awaitingTotal)}) still need${awaiting === 1 ? 's' : ''} payment confirmation.`);
  }
  if (totalOpex > 0) {
    const [topCat, topAmt] = [...expByCat.entries()].sort((a, b) => b[1] - a[1])[0];
    financeInsights.push(`Your biggest expense category this period is ${topCat} (${fmt(topAmt)}).`);
  }

  const pnlLines: { label: string; value: number; kind?: 'sub' | 'total' | 'net' | 'memo' }[] = [
    // "Booked orders": revenue from orders that count toward P&L. Two memos
    // qualify it (neither is a deduction): a chunk hasn't landed as cash yet,
    // and 'pending' COD orders are booked before the customer confirms — a
    // sale-time backlog shouldn't read as done revenue.
    { label: 'Revenue (booked orders)', value: revenue },
    ...(notReceivedRevenue > 0
      ? [{ label: 'of which not yet received', value: notReceivedRevenue, kind: 'memo' as const }]
      : []),
    ...(pendingRevenue > 0
      ? [{ label: 'of which awaiting customer confirmation', value: pendingRevenue, kind: 'memo' as const }]
      : []),
    { label: 'Cost of goods (COGS)', value: -cogs, kind: 'sub' },
    { label: 'Delivery cost', value: -deliveryCost, kind: 'sub' },
    ...(estimatedDeliveryOrders > 0
      ? [{ label: `of which estimated (${estimatedDeliveryOrders} order${estimatedDeliveryOrders === 1 ? '' : 's'} at PKR ${defaultDeliveryCost.toLocaleString()})`, value: estimatedDeliveryOrders * defaultDeliveryCost, kind: 'memo' as const }]
      : []),
    { label: 'Payment fees', value: -paymentFees, kind: 'sub' },
    { label: 'Gross profit', value: grossProfit, kind: 'total' },
    // Returned/refused deliveries: courier round-trip charge + sunk payment
    // fees, zero revenue. Shown only when there are returns in the window.
    ...(returned.count > 0 && returnedTotalLoss > 0
      ? [{ label: `Returned deliveries (${returned.count} order${returned.count === 1 ? '' : 's'}${returned.estimatedCount > 0 ? ', partly estimated' : ''})`, value: -returnedTotalLoss, kind: 'sub' as const }]
      : []),
    ...[...expByCat.entries()].map(([c, v]) => ({ label: `– ${c}`, value: -v, kind: 'sub' as const })),
    { label: 'Net profit', value: netProfit, kind: 'net' as const },
  ];

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <FinanceTabs
        active="overview"
        params={{ range: rangeParam ? range.key : undefined, method: methodFilter ?? undefined }}
        codBadge={codBadge}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Finance</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>Profit &amp; loss, ad spend and ROAS, last {range.label.toLowerCase()}.</p>
        </div>
        {/* Shared URL-synced range picker; preserves the active ?method= filter. */}
        <Suspense fallback={null}>
          <RangePicker param="range" value={range.key} options={RANGES.map(r => ({ value: r.key, label: r.label }))} />
        </Suspense>
      </div>

      {err && <div style={{ ...card, padding: '12px 16px', marginBottom: 16, background: '#fef2f2', color: '#991b1b', fontSize: '0.875rem' }}>{err}</div>}
      {ok && <div style={{ ...card, padding: '12px 16px', marginBottom: 16, background: '#f0fdf4', color: '#166534', fontSize: '0.875rem' }}>Saved.</div>}

      <InsightCallouts items={financeInsights} />

      {/* Money a vendor owes the store — pending settlements sat invisible on
          Finance for weeks; the Vendors page has the detail. */}
      {vendorReceivable > 0 && (
        <div style={{ ...card, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: '0.875rem', color: '#374151' }}>
            Vendors owe you <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(vendorReceivable)}</strong> across {owedToUs.length} pending settlement{owedToUs.length === 1 ? '' : 's'}
            {vendorReceivableOldestDays > 0 && <> (oldest {vendorReceivableOldestDays} day{vendorReceivableOldestDays === 1 ? '' : 's'})</>}.
          </span>
          <Link href="/admin/vendors" style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#C5286A', textDecoration: 'none' }}>Settle on Vendors →</Link>
        </div>
      )}

      {/* KPIs */}
      <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Revenue" value={fmt(revenue)} accent="#0369a1" spark={revenueSpark} />
        <KpiCard label="Net profit" value={fmt(netProfit)} accent={profitColor} />
        <KpiCard label="Net margin" value={`${margin.toFixed(1)}%`} accent={profitColor} />
        {/* Replaced the forever-zero Ad spend tile (expenses ledger is empty;
            ad spend still shows in the ROAS card + P&L) with the number a COD
            business actually runs on: booked money not yet in the bank. */}
        <KpiCard
          label="Cash not in hand yet"
          value={fmt(notReceivedRevenue)}
          accent="#b45309"
          hint={`${fmt(storeCodOutstanding)} COD to confirm · ${fmt(gatewayAwaitingTotal)} gateway${vendorHeldTotal > 0 ? ` · vendor holds ${fmt(vendorHeldTotal)}` : ''}`}
        />
      </div>

      <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* P&L breakdown */}
        <div style={card}>
          <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Profit &amp; loss</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <tbody>
              {pnlLines.map((l, i) => (
                <tr key={i} style={{
                  borderTop: l.kind === 'total' || l.kind === 'net' ? '1px solid #e5e7eb' : 'none',
                }}>
                  <td style={{ padding: '8px 0', color: l.kind === 'net' ? '#111827' : l.kind === 'memo' ? '#9ca3af' : '#374151', fontWeight: l.kind === 'total' || l.kind === 'net' ? 700 : 400, fontStyle: l.kind === 'memo' ? 'italic' : 'normal', paddingLeft: l.kind === 'sub' || l.kind === 'memo' ? 12 : 0 }}>{l.label}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: l.kind === 'total' || l.kind === 'net' ? 700 : 400,
                    fontStyle: l.kind === 'memo' ? 'italic' : 'normal',
                    color: l.kind === 'net' ? profitColor : l.kind === 'memo' ? '#9ca3af' : l.value < 0 ? '#b91c1c' : '#111827' }}>
                    {l.kind === 'memo' ? fmt(l.value) : l.value < 0 ? `(${fmt(-l.value)})` : fmt(l.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {revenue > 0 && totalOpex === 0 && (
            <p style={{ margin: '12px 0 0', fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>
              No expenses logged for this period, so Net profit includes no overheads or ad spend. Log them in the Expenses table below.
            </p>
          )}
        </div>

        {/* ROAS */}
        <div style={card}>
          <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Ad performance (ROAS)</h2>
          <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
            {blendedRoas != null
              ? <>Blended ROAS <strong style={{ color: '#111827' }}>{blendedRoas.toFixed(2)}×</strong> · {fmt(attributedRevenue)} revenue from tagged orders vs {fmt(adSpend)} ad spend</>
              : adSpend > 0
                ? <>{fmt(adSpend)} ad spend, but no revenue is attributed yet — add UTM tags to your ad links (e.g. <code>?utm_source=instagram</code>) so orders can be credited.</>
                : <>{fmt(attributedRevenue)} revenue from tagged orders · no ad spend logged for this period.</>}
          </p>
          {bySource.size === 0 && adByChannel.size === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
              No tagged orders or ad spend yet. Add UTM tags to ad links (e.g. <code>?utm_source=instagram</code>) and log ad spend below.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead><tr style={{ color: '#6b7280', textAlign: 'left' }}>
                <th style={{ padding: '4px 0', fontWeight: 600 }}>Source</th>
                <th style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>Orders</th>
                <th style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>Revenue</th>
              </tr></thead>
              <tbody>
                {[...bySource.entries()].sort((a, b) => b[1].revenue - a[1].revenue).map(([src, v]) => (
                  <tr key={src} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 0', color: '#374151' }}>{src}</td>
                    <td style={{ padding: '6px 0', textAlign: 'right' }}>{v.orders}</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(v.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Shipping recovery — charged vs delivery cost, so the flat-rate saving
          (or free-shipping subsidy) is explicit. */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Shipping recovery</h2>
          <span style={{ fontSize: '0.75rem', color: shippingNet >= 0 ? '#15803d' : '#dc2626', fontWeight: 700 }}>
            {shippingNet >= 0 ? `+${fmt(shippingNet)} kept` : `${fmt(-shippingNet)} subsidised`}
          </span>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: '#6b7280' }}>
          What you charged for delivery vs what the courier costs you, this period.
          {defaultDeliveryCost > 0
            ? ` Orders without a recorded courier charge use your typical cost (PKR ${defaultDeliveryCost.toLocaleString()})${estimatedDeliveryOrders > 0 ? ` — ${estimatedDeliveryOrders} order${estimatedDeliveryOrders === 1 ? '' : 's'} estimated` : ''}.`
            : ' Set a typical delivery cost in Settings → Shipping to estimate orders where the exact courier charge isn’t recorded.'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }} className="adm-stat-grid">
          <div style={{ padding: '12px 14px', background: '#f9fafb', border: '1px solid #eef0f2', borderRadius: 8 }}>
            <div style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Charged to customers</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmt(shippingCharged)}</div>
          </div>
          <div style={{ padding: '12px 14px', background: '#f9fafb', border: '1px solid #eef0f2', borderRadius: 8 }}>
            <div style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Delivery cost</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmt(shippingDeliveryCost)}</div>
          </div>
          <div style={{ padding: '12px 14px', background: shippingNet >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${shippingNet >= 0 ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8 }}>
            <div style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Net shipping margin</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: shippingNet >= 0 ? '#15803d' : '#dc2626', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
              {shippingNet >= 0 ? fmt(shippingNet) : `(${fmt(-shippingNet)})`}
            </div>
          </div>
        </div>
        {/* Refused / returned deliveries — courier billed the round trip, no
            revenue collected. A pure loss, shown apart from the margin above so
            it isn't mistaken for a subsidised (but completed) sale. */}
        {returned.count > 0 && (
          <div style={{ marginTop: 12, padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Returned / refused deliveries (loss)</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>
                {returned.count} order{returned.count === 1 ? '' : 's'} came back — courier round-trip charge, zero revenue. Net margin after returns: <strong style={{ color: shippingNetAfterReturns >= 0 ? '#15803d' : '#dc2626' }}>{shippingNetAfterReturns >= 0 ? fmt(shippingNetAfterReturns) : `(${fmt(-shippingNetAfterReturns)})`}</strong>.
                {returned.vendorDeliveredCount > 0 && ` ${returned.vendorDeliveredCount} of these ${returned.vendorDeliveredCount === 1 ? 'was' : 'were'} vendor-delivered (no store courier charge).`}
                {returned.estimatedCount > 0 && ` ${returned.estimatedCount} estimated at PKR ${defaultDeliveryCost.toLocaleString()}.`}
                {returned.fees > 0 && ` Plus ${fmt(returned.fees)} in sunk payment fees, deducted in the P&L.`}
              </div>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>(&minus;{fmt(returned.loss)})</div>
          </div>
        )}
        {/* TCS cost sync: pull the real per-consignment charge from the
            Payment Detail ledger so these numbers run on actuals, not the
            typical-cost estimate. The button needs the payment credential
            (TCS_CUSTOMER_NO) AND the orders-write permission — a visible hint
            replaces it when either is missing, so a misconfigured sync is
            never invisible again. */}
        {tcsConfigured && (
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#6b7280' }}>
              Costs last synced from TCS:{' '}
              {costSyncLast
                ? <>{fmtDate(costSyncLast.at)} · {costSyncLast.updated} order{costSyncLast.updated === 1 ? '' : 's'} updated of {costSyncLast.matched} matched</>
                : <strong style={{ color: '#b45309' }}>never</strong>}
            </p>
            {!tcsPaymentReady ? (
              <p style={{ margin: 0, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: '0.8125rem', color: '#92400e' }}>
                Cost sync is not configured: set <code>TCS_CUSTOMER_NO</code> in the server environment (see docs/TCS-SETUP.md).
                Until then, delivery costs stay estimated or hand-typed.
              </p>
            ) : canRunCostSync ? (
              <ReconcileTcsButton />
            ) : null}
          </div>
        )}
      </div>

      {/* Returns impact — count, rate, GMV lost and cash cost. The shipping
          card shows only the courier loss; July's real damage was 36-40% of
          booked GMV coming back. Counted by order date; courier RTO / COD
          refusal (orders.status = returned), distinct from the Returns
          page's customer return requests. */}
      {returnedRows.length > 0 && (
        <div style={{ ...card, marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Returns impact</h2>
          <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: '#6b7280' }}>
            Parcels that came back (refused or returned to origin), by order date. The GMV was never collected; the cash cost below is deducted from Net profit.
          </p>
          <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div style={{ padding: '12px 14px', background: '#f9fafb', border: '1px solid #eef0f2', borderRadius: 8 }}>
              <div style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Returned orders</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{returnedRows.length}</div>
            </div>
            <div style={{ padding: '12px 14px', background: '#f9fafb', border: '1px solid #eef0f2', borderRadius: 8 }}>
              <div style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Return rate</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: returnRate != null && returnRate > 20 ? '#dc2626' : '#111827', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{returnRate != null ? `${returnRate.toFixed(1)}%` : '—'}</div>
              <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: 2 }}>of parcels that reached a customer</div>
            </div>
            <div style={{ padding: '12px 14px', background: '#f9fafb', border: '1px solid #eef0f2', borderRadius: 8 }}>
              <div style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>GMV lost</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmt(returnedGmv)}</div>
            </div>
            <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
              <div style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cash cost (courier + fees)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmt(returnedTotalLoss)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly P&L, All-time view only: July vs August at a glance. */}
      {monthRows.length > 0 && (
        <div style={{ ...card, marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>By month</h2>
          <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: '#6b7280' }}>
            Calendar months in Pakistan time. Net here is before overheads (log expenses below to complete the picture); returns loss is booked to the month the order was placed.
          </p>
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead><tr style={{ color: '#6b7280', textAlign: 'left', background: '#f9fafb' }}>
              {['Month', 'Orders', 'Revenue', 'COGS', 'Delivery', 'Fees', 'Returns loss', 'Net'].map((h, i) => (
                <th key={h} style={{ padding: '8px 10px', fontWeight: 600, textAlign: i >= 1 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {monthRows.map(m => (
                <tr key={m.month} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td data-label="Month" style={{ padding: '8px 10px', color: '#374151', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {new Date(`${m.month}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}
                  </td>
                  <td data-label="Orders" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.orders}</td>
                  <td data-label="Revenue" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(m.revenue)}</td>
                  <td data-label="COGS" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#b91c1c' }}>{m.cogs > 0 ? `(${fmt(m.cogs)})` : fmt(0)}</td>
                  <td data-label="Delivery" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#b91c1c' }}>{m.delivery > 0 ? `(${fmt(m.delivery)})` : fmt(0)}</td>
                  <td data-label="Fees" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#b91c1c' }}>{m.fees > 0 ? `(${fmt(m.fees)})` : fmt(0)}</td>
                  <td data-label="Returns loss" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#b91c1c' }}>{m.returnsLoss > 0 ? `(${fmt(m.returnsLoss)})` : fmt(0)}</td>
                  <td data-label="Net" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: m.net >= 0 ? '#15803d' : '#dc2626' }}>{fmt(m.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Revenue & profit by payment method */}
      <div style={{ ...card, marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Revenue by payment method</h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
          Where the money comes in, and the gross profit per method (after cost of goods, delivery and payment fees; before shared overheads).
        </p>
        {methodRows.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>No orders in this period.</p>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead><tr style={{ color: '#6b7280', textAlign: 'left', background: '#f9fafb' }}>
              {['Method', 'Orders', 'Revenue', 'Costs', 'Gross profit', 'Margin'].map((h, i) => (
                <th key={h} style={{ padding: '8px 10px', fontWeight: 600, textAlign: i >= 1 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {methodRows.map(r => (
                <tr key={r.method} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td data-label="Method" style={{ padding: '8px 10px', color: '#374151', fontWeight: 600 }}>{PAY_METHOD_LABELS[r.method] ?? r.method}</td>
                  <td data-label="Orders" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.orders}</td>
                  <td data-label="Revenue" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.revenue)}</td>
                  <td data-label="Costs" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#b91c1c' }}>{r.costs > 0 ? `(${fmt(r.costs)})` : fmt(0)}</td>
                  <td data-label="Gross profit" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: r.gross >= 0 ? '#15803d' : '#dc2626' }}>{fmt(r.gross)}</td>
                  <td data-label="Margin" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>{r.margin.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Revenue by reconciled account */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Revenue by account</h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
              Where payments actually landed, as reconciled on each order. &quot;Unrecorded&quot; is anything not yet marked received (incl. COD collected on delivery).
            </p>
          </div>
          {awaiting > 0 && (
            <span style={{ padding: '4px 10px', borderRadius: 999, background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {awaiting} awaiting confirmation
            </span>
          )}
        </div>
        {accountRows.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>No orders in this period.</p>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead><tr style={{ color: '#6b7280', textAlign: 'left', background: '#f9fafb' }}>
              {['Account', 'Orders', 'Revenue'].map((h, i) => (
                <th key={h} style={{ padding: '8px 10px', fontWeight: 600, textAlign: i >= 1 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {accountRows.map(r => (
                <tr key={r.account} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td data-label="Account" style={{ padding: '8px 10px', color: r.account === 'Unrecorded' ? '#9ca3af' : '#374151', fontWeight: r.account === 'Unrecorded' ? 400 : 600 }}>{r.account}</td>
                  <td data-label="Orders" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.orders}</td>
                  <td data-label="Revenue" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Awaiting payment confirmation, non-COD orders not yet reconciled. */}
      {awaitingOrders.length > 0 && (
        <div style={{ ...card, marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Awaiting payment confirmation ({awaitingOrders.length})</h2>
          <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
            Non-COD orders with no recorded payment yet. Open one to record which account the money landed in.
          </p>
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead><tr style={{ color: '#6b7280', textAlign: 'left', background: '#f9fafb' }}>
              {['Order', 'Date', 'Method', 'Total'].map((h, i) => (
                <th key={h} style={{ padding: '8px 10px', fontWeight: 600, textAlign: i >= 3 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {awaitingOrders.slice(0, 100).map(o => (
                <tr key={o.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td data-label="Order" style={{ padding: '8px 10px' }}>
                    <a href={`/admin/orders/${o.id}`} style={{ color: '#C5286A', textDecoration: 'none', fontWeight: 600 }}>{o.order_number ?? o.id.slice(0, 8)}</a>
                  </td>
                  <td data-label="Date" style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: '#6b7280' }}>{o.created_at ? fmtDate(o.created_at) : '—'}</td>
                  <td data-label="Method" style={{ padding: '8px 10px', color: '#374151' }}>{PAY_METHOD_LABELS[o.pay_method ?? 'unknown'] ?? o.pay_method}</td>
                  <td data-label="Total" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-order finance table */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Orders in this period</h2>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
              Profit per order after recorded costs. {orderRowsTotal > ORDER_ROW_CAP ? `Showing the latest ${ORDER_ROW_CAP} of ${orderRowsTotal.toLocaleString()}` : `${orderRowsTotal.toLocaleString()} order${orderRowsTotal === 1 ? '' : 's'}`}{methodFilter ? ` · ${PAY_METHOD_LABELS[methodFilter]}` : ''}.
            </p>
          </div>
          <a href={`/admin/finance/export?${orderTableQs}`} style={{ padding: '7px 14px', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none', border: '1px solid #d1d5db', background: 'white', color: '#374151', whiteSpace: 'nowrap' }}>
            Export CSV
          </a>
        </div>
        {/* Payment-method filter (scopes this table + the CSV export). */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {['', ...methodsPresent].map(m => {
            const active = (m || null) === methodFilter;
            return (
              <a key={m || 'all'} href={`/admin/finance?range=${range.key}${m ? `&method=${m}` : ''}`} style={{
                padding: '5px 11px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none',
                border: '1px solid', borderColor: active ? '#111827' : '#e5e7eb',
                background: active ? '#111827' : 'white', color: active ? '#fff' : '#6b7280',
              }}>{m ? (PAY_METHOD_LABELS[m] ?? m) : 'All methods'}</a>
            );
          })}
        </div>
        {orderRows.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>No orders in this period.</p>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead><tr style={{ color: '#6b7280', textAlign: 'left', background: '#f9fafb' }}>
              {['Order', 'Date', 'Method', 'Total', 'Costs', 'Gross profit', 'Margin'].map((h, i) => (
                <th key={h} style={{ padding: '8px 10px', fontWeight: 600, textAlign: i >= 3 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {orderRows.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td data-label="Order" style={{ padding: '8px 10px' }}>
                    <a href={`/admin/orders/${r.id}`} style={{ color: '#C5286A', textDecoration: 'none', fontWeight: 600 }}>{r.order_number ?? r.id.slice(0, 8)}</a>
                  </td>
                  <td data-label="Date" style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: '#6b7280' }}>{r.created_at ? fmtDate(r.created_at) : '—'}</td>
                  <td data-label="Method" style={{ padding: '8px 10px', color: '#374151' }}>{PAY_METHOD_LABELS[r.method] ?? r.method}</td>
                  <td data-label="Total" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.total)}</td>
                  <td data-label="Costs" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#b91c1c' }}>{r.costs > 0 ? `(${fmt(r.costs)})` : fmt(0)}</td>
                  <td data-label="Gross profit" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: r.gross >= 0 ? '#15803d' : '#dc2626' }}>{fmt(r.gross)}</td>
                  <td data-label="Margin" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }} title={r.margin == null ? 'No product cost recorded — margin unknown' : undefined}>{r.margin == null ? '—' : `${r.margin.toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {missingCogsOrders > 0 && (
          <p style={{ margin: '12px 0 0', padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: '0.8125rem', color: '#92400e' }}>
            {missingCogsOrders} order{missingCogsOrders === 1 ? ' has' : 's have'} no product cost recorded anywhere, so
            {missingCogsOrders === 1 ? ' its margin shows' : ' their margins show'} as &ldquo;—&rdquo; and the P&amp;L&rsquo;s COGS line is understated.
            Set the cost price on the product page (or an acquisition cost on the order) to fix this.
          </p>
        )}
      </div>

      {/* Expenses ledger */}
      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Expenses</h2>

        <form action={addExpense} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
          {/* Preserve the active range through the post-save redirect. */}
          <input type="hidden" name="range" value={range.key} />
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Date<br />
            <input type="date" name="incurred_on" defaultValue={new Date().toISOString().slice(0, 10)} style={inp} />
          </label>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Category<br />
            <select name="category" defaultValue="Ads" style={inp}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Channel (ads/marketing)<br />
            <input list="ad-channels" name="channel" placeholder="Meta" style={inp} />
            <datalist id="ad-channels">{AD_CHANNELS.map(c => <option key={c} value={c} />)}</datalist>
          </label>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Amount (PKR)<br />
            <input type="number" name="amount" min="0" step="1" required placeholder="0" style={inp} />
          </label>
          <label style={{ fontSize: '0.75rem', color: '#6b7280', flex: '1 1 160px' }}>Note<br />
            <input type="text" name="note" placeholder="optional" style={{ ...inp, width: '100%' }} />
          </label>
          <button type="submit" style={{ padding: '9px 18px', background: '#C5286A', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Add</button>
        </form>

        {expenses.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>No expenses logged in this period.</p>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead><tr style={{ color: '#6b7280', textAlign: 'left', background: '#f9fafb' }}>
              {['Date', 'Category', 'Channel', 'Amount', 'Note', ''].map(h => <th key={h} style={{ padding: '8px 10px', fontWeight: 600 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td data-label="Date" style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{fmtDate(e.incurred_on)}</td>
                  <td data-label="Category" style={{ padding: '8px 10px' }}>{e.category}</td>
                  <td data-label="Channel" style={{ padding: '8px 10px', color: '#6b7280' }}>{e.channel ?? '—'}</td>
                  <td data-label="Amount" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(e.amount))}</td>
                  <td data-label="Note" style={{ padding: '8px 10px', color: '#6b7280' }}>{e.note ?? ''}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                    <DeleteButton
                      id={e.id}
                      action={deleteExpense}
                      confirmMsg={`Delete this ${fmt(Number(e.amount))} ${e.category} expense? This can't be undone.`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  display: 'block', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '0.875rem', color: '#111827', background: 'white',
};
