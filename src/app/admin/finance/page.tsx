export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { supabaseAdmin, getSiteSettings } from '@/lib/supabase';
import { parseCommerceConfig } from '@/lib/commerce';
import { configuredAdapterIds } from '@/lib/couriers';
import { ReconcileTcsButton } from '@/components/admin/ReconcileTcsButton';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { fmtPKR as fmt } from '@/lib/money';
import { FINANCE_RANGES as RANGES, resolveRange, rangeStartISO, loadFinanceOrders, toOrderFinanceRow } from '@/lib/finance';
import { PAY_METHOD_LABELS } from '@/types';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { FinanceTabs } from '@/components/admin/FinanceTabs';
import { KpiCard } from '@/components/admin/insights/KpiCard';
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
  const fromISO = rangeStartISO(range.days);
  const fromDay = fromISO?.slice(0, 10) ?? null;
  // Optional payment-method filter for the per-order table + CSV export.
  const methodFilter = methodParam && PAY_METHOD_LABELS[methodParam] ? methodParam : null;

  const admin = supabaseAdmin();

  // Revenue-eligible orders + per-order COGS (shared with the export route).
  const { orders, cogsByOrder } = await loadFinanceOrders(fromISO);
  const cogs = [...cogsByOrder.values()].reduce((s, v) => s + v, 0);

  // Operating expenses in range (ad spend + overheads).
  let eq = admin.from('expenses').select('id, incurred_on, category, channel, amount, note');
  if (fromDay) eq = eq.gte('incurred_on', fromDay);
  const { data: expenseData } = await eq.order('incurred_on', { ascending: false });
  const expenses = (expenseData ?? []) as ExpenseRow[];

  // ── Aggregate ──
  const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;
  const revenue = orders.reduce((s, o) => s + num(o.total), 0);
  const deliveryCost = orders.reduce((s, o) => s + num(o.delivery_cost), 0);
  const paymentFees = orders.reduce((s, o) => s + num(o.payment_fee), 0);
  const grossProfit = revenue - cogs - deliveryCost - paymentFees;

  // ── Shipping recovery ── what we charged customers for delivery vs what the
  // courier costs us. Uses each order's recorded delivery_cost, falling back to
  // the owner's "typical delivery cost" baseline (Settings → Shipping) so orders
  // without an exact figure still count. This makes the flat-rate saving (or the
  // free-shipping subsidy) explicit rather than buried in the P&L.
  const defaultDeliveryCost = parseCommerceConfig(await getSiteSettings()).defaultDeliveryCost;
  const shippingCharged = orders.reduce((s, o) => s + num(o.shipping), 0);
  const shippingDeliveryCost = orders.reduce(
    (s, o) => s + (o.delivery_cost != null ? num(o.delivery_cost) : defaultDeliveryCost),
    0,
  );
  const shippingNet = shippingCharged - shippingDeliveryCost;
  const estimatedDeliveryOrders = defaultDeliveryCost > 0 ? orders.filter(o => o.delivery_cost == null).length : 0;

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
  const netProfit = grossProfit - totalOpex;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  // ROAS, revenue attributable to a paid source (orders carrying a utm_source).
  const bySource = new Map<string, { revenue: number; orders: number }>();
  for (const o of orders) {
    if (!o.utm_source) continue;
    const cur = bySource.get(o.utm_source) ?? { revenue: 0, orders: 0 };
    cur.revenue += num(o.total); cur.orders += 1;
    bySource.set(o.utm_source, cur);
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
  let notReceivedRevenue = 0;
  for (const o of orders) {
    if (!o.payment_received_at) notReceivedRevenue += num(o.total);
    if (o.pay_method !== 'cod' && !o.payment_received_at) awaiting += 1;
    const key = o.payment_account?.trim() || 'Unrecorded';
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
    .filter(o => o.pay_method !== 'cod' && !o.payment_received_at)
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
  const revenueSpark: number[] = range.days != null && fromISO
    ? Array.from({ length: range.days }, (_, i) => {
        const day = new Date(new Date(fromISO).getTime() + i * 86_400_000).toISOString().slice(0, 10);
        return revByDay.get(day) ?? 0;
      })
    : [...revByDay.keys()].sort().map(day => revByDay.get(day) ?? 0);

  const card: React.CSSProperties = { background: 'white', borderRadius: 12, padding: 24, border: '1px solid #eef0f2', boxShadow: '0 1px 2px rgba(16,24,40,0.04)' };
  const profitColor = netProfit >= 0 ? '#15803d' : '#dc2626';

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
    // "Confirmed orders" not "paid": the figure is booked revenue from orders
    // that count toward P&L; a chunk of it (COD not yet collected, gateway
    // orders not yet confirmed) hasn't landed as cash — called out on the next
    // line (a memo, not a deduction) so the number isn't mistaken for cash.
    { label: 'Revenue (confirmed orders)', value: revenue },
    ...(notReceivedRevenue > 0
      ? [{ label: 'of which not yet received', value: notReceivedRevenue, kind: 'memo' as const }]
      : []),
    { label: 'Cost of goods (COGS)', value: -cogs, kind: 'sub' },
    { label: 'Delivery cost', value: -deliveryCost, kind: 'sub' },
    { label: 'Payment fees', value: -paymentFees, kind: 'sub' },
    { label: 'Gross profit', value: grossProfit, kind: 'total' },
    ...[...expByCat.entries()].map(([c, v]) => ({ label: `– ${c}`, value: -v, kind: 'sub' as const })),
    { label: 'Net profit', value: netProfit, kind: 'net' as const },
  ];

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <FinanceTabs active="overview" />
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

      {/* KPIs */}
      <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Revenue" value={fmt(revenue)} accent="#0369a1" spark={revenueSpark} />
        <KpiCard label="Net profit" value={fmt(netProfit)} accent={profitColor} />
        <KpiCard label="Net margin" value={`${margin.toFixed(1)}%`} accent={profitColor} />
        <KpiCard label="Ad spend" value={fmt(adSpend)} accent="#b45309" hint="logged in Expenses below" />
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
        {/* When TCS is wired, pull the real per-consignment charge from its
            Payment Detail ledger so these numbers run on actuals, not the
            typical-cost estimate. */}
        {configuredAdapterIds().includes('TCS') && <ReconcileTcsButton />}
      </div>

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
                  <td data-label="Margin" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>{r.margin.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Expenses ledger */}
      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Expenses</h2>

        <form action={addExpense} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Date<br />
            <input type="date" name="incurred_on" defaultValue={new Date().toISOString().slice(0, 10)} style={inp} />
          </label>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Category<br />
            <select name="category" defaultValue="Ads" style={inp}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Channel (ads)<br />
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
