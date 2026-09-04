export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { PostHogWidget } from '@/components/admin/PostHogWidget';
import { ConversionFunnelWidget } from '@/components/admin/ConversionFunnelWidget';
import { TopPagesWidget } from '@/components/admin/TopPagesWidget';
import { TopEventsWidget } from '@/components/admin/TopEventsWidget';
import { DeviceBrowserWidget } from '@/components/admin/DeviceBrowserWidget';
import { EngagementWidget } from '@/components/admin/EngagementWidget';
import { GeographyWidget } from '@/components/admin/GeographyWidget';
import { ShoppingIntentWidget } from '@/components/admin/ShoppingIntentWidget';
import { UserJourneysWidget } from '@/components/admin/UserJourneysWidget';
import { FunnelBySourceWidget } from '@/components/admin/FunnelBySourceWidget';
import { FunnelByDeviceWidget } from '@/components/admin/FunnelByDeviceWidget';
import { RetentionWidget } from '@/components/admin/RetentionWidget';
import { SessionRecordingsWidget } from '@/components/admin/SessionRecordingsWidget';
import { WebVitalsWidget } from '@/components/admin/WebVitalsWidget';
import { BingSearchWidget } from '@/components/admin/BingSearchWidget';
import { TrafficSearchDashboard } from '@/components/admin/insights/TrafficSearchDashboard';
import { getTrafficSearchData } from '@/lib/traffic-insights';
import { RefreshAnalyticsButton } from '@/components/admin/RefreshAnalyticsButton';
import { RangePicker } from '@/components/admin/insights/RangePicker';
import { KpiCard } from '@/components/admin/insights/KpiCard';
import { InsightCallouts } from '@/components/admin/insights/InsightCallouts';
import { pctDelta } from '@/components/admin/insights/format';
import { ORDER_STATUS_COLORS } from '@/components/admin/OrderStatusBadge';
import { brandPlusName } from '@/lib/product-display';
import { channelOf, UNTAGGED } from '@/lib/channels';
import { NewReturningChart, type NewReturningBucket } from '@/components/admin/NewReturningChart';
import { can } from '@/lib/permissions';
import { ORDER_STATUS_LABELS } from '@/types';
import type { OrderStatus } from '@/types';
import { PK_TZ } from '@/lib/dates';

const fmt = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

interface DailyRow { day: string; orders: number; revenue: number; aov: number }
interface KpiRow { total_orders: number; total_revenue: number; aov: number; unique_customers: number; repeat_purchase_rate: number; lifetime_orders: number; lifetime_revenue: number }
interface StatusRow { status: string; count: number }
interface TopRow { product_id: string; units: number; revenue: number }
interface RfmRow { segment: string; customers: number; total_revenue: number }
interface CohortRow { cohort_month: string; month_offset: number; customers: number }
// New-vs-returning split per day ("returning" = the customer had an earlier
// order before this one; platform revenue rules).
interface ReturningRow { day: string; new_orders: number; new_revenue: number; returning_orders: number; returning_revenue: number }
interface UnitsRow { avg_units: number; avg_lines: number }
interface RegionRow { city: string; province: string | null; orders: number; revenue: number }

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T[]> {
  // Service-role client: every analytics_* RPC is revoked from anon/authenticated
  // (the security_revoke_anon_rpc migration). They carry revenue/segment data.
  const { data, error } = await supabaseAdmin().rpc(name as never, args as never);
  if (error) {
    const { log } = await import('@/lib/logger');
    log.warn('analytics.rpc_failed', { rpc: name, message: error.message });
    return [];
  }
  return (data ?? []) as T[];
}

// Question-oriented tabs (the Stripe/Shopify pattern): each tab answers one
// question instead of mixing money and audience widgets on one wall.
//   Sales     — am I selling more?        Customers — who buys, do they return?
//   Traffic   — is anyone finding us?     Funnels   — where do shoppers leak?
// Traffic and Funnels need the analytics_traffic permission.
type Tab = 'sales' | 'sources' | 'customers' | 'traffic' | 'funnels';
const TABS: { key: Tab; label: string; traffic?: boolean }[] = [
  { key: 'sales', label: 'Sales' },
  { key: 'sources', label: 'Sources' },
  { key: 'customers', label: 'Customers' },
  { key: 'traffic', label: 'Traffic', traffic: true },
  { key: 'funnels', label: 'Funnels', traffic: true },
];

// Sales-channel attribution (utm_source wins, else referrer host, else
// UNTAGGED) lives in the shared module so Finance → Ad performance groups by
// the exact same channel names. See src/lib/channels.ts.
interface AttrOrder { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; referrer: string | null; landing_page: string | null; total: number | null; status: string | null }

// Time-series granularity: staff pick Day / Week / Month and the daily revenue
// series is rolled up to matching buckets. Weeks start Monday; months on the
// 1st. Dates are treated as UTC calendar days (they're 'YYYY-MM-DD' bucket
// keys from analytics_daily, already PKT-bucketed server-side).
type Gran = 'day' | 'week' | 'month';
function bucketKey(isoDay: string, gran: Gran): string {
  if (gran === 'month') return `${isoDay.slice(0, 7)}-01`;
  if (gran === 'week') {
    const d = new Date(`${isoDay}T00:00:00Z`);
    const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
    d.setUTCDate(d.getUTCDate() - dow);
    return d.toISOString().slice(0, 10);
  }
  return isoDay;
}
function rollUp(daily: { day: string; revenue: number | string }[], gran: Gran): { date: string; revenue: number }[] {
  if (gran === 'day') return daily.map(d => ({ date: d.day, revenue: Number(d.revenue) }));
  const map = new Map<string, number>();
  for (const d of daily) {
    const k = bucketKey(d.day, gran);
    map.set(k, (map.get(k) ?? 0) + Number(d.revenue));
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, revenue]) => ({ date, revenue }));
}

// Labelled section wrapper for the Traffic tab — turns a flat stack of widgets
// into a scannable dashboard (title + one-line context, consistent spacing).
function TrafficSection({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>{title}</h2>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{hint}</span>
      </div>
      {children}
    </section>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; tab?: string; g?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('analytics'))) {
    return <NoAccess section="Analytics" />;
  }

  const canTraffic = !session || can(session, 'analytics_traffic');
  const canRefresh = !session || can(session, 'analytics_refresh');

  const sp = await searchParams;
  const window = Math.max(1, Math.min(365, Number(sp.days ?? '30')));
  // Back-compat: the pre-redesign tabs were 'finance' and 'customers'.
  const rawTab = sp.tab === 'finance' ? 'sales' : (sp.tab ?? 'sales');
  let tab: Tab = (TABS.some(t => t.key === rawTab) ? rawTab : 'sales') as Tab;
  if ((tab === 'traffic' || tab === 'funnels') && !canTraffic) tab = 'sales';
  // Time-series grouping for the Sales revenue chart: Day / Week / Month.
  const gran: Gran = (['day', 'week', 'month'].includes(sp.g ?? '') ? sp.g : 'day') as Gran;

  // Double-window daily series: the last `window` days are the charts/KPIs,
  // the `window` days before them are the delta baseline — one source for
  // headline, sparkline and trend pill, so they can never disagree.
  const [daily2x, kpis, byStatus, top, rfm, cohort, returning2x, unitsRow, byRegion] = await Promise.all([
    rpc<DailyRow>('analytics_daily', { p_days: window * 2 }),
    rpc<KpiRow>('analytics_kpis', { p_days: window }).then(rows => rows[0]),
    rpc<StatusRow>('analytics_orders_by_status'),
    rpc<TopRow>('analytics_top_products', { p_days: window, p_limit: 10 }),
    rpc<RfmRow>('analytics_rfm_segments'),
    rpc<CohortRow>('analytics_cohort_retention', { p_months: 6 }),
    // Double window (same pattern as analytics_daily above): the last
    // `window` days are the chart/KPIs, the days before are the delta base.
    rpc<ReturningRow>('analytics_returning_split', { p_days: window * 2 }),
    rpc<UnitsRow>('analytics_units_per_order', { p_days: window }).then(rows => rows[0]),
    rpc<RegionRow>('analytics_sales_by_region', { p_days: window }),
  ]);
  const daily = daily2x.slice(-window);
  const prevDaily = daily2x.slice(-(window * 2), -window);
  const sum = (rows: DailyRow[], f: (r: DailyRow) => number) => rows.reduce((s, r) => s + (f(r) || 0), 0);
  const curRev = sum(daily, r => Number(r.revenue));
  const prevRev = sum(prevDaily, r => Number(r.revenue));
  const curOrders = sum(daily, r => Number(r.orders));
  const prevOrders = sum(prevDaily, r => Number(r.orders));
  const curAov = curOrders > 0 ? curRev / curOrders : 0;
  const prevAov = prevOrders > 0 ? prevRev / prevOrders : 0;
  const vsLabel = `vs prev ${window}d`;

  // Drill-through: the orders list's range chips match 7/30/90-day windows.
  const ordersRange: Record<number, string | undefined> = { 7: '7d', 30: '30d', 90: '90d' };
  const ordersHref = ordersRange[window] ? `/admin/orders?range=${ordersRange[window]}` : '/admin/orders';

  // Map top product ids → product details.
  const topIds = top.map(t => t.product_id);
  const productMap = new Map<string, { brand: string; name: string; slug: string }>();
  if (topIds.length) {
    // Service-role read: top sellers can be archived/draft products, which
    // the anon client's RLS would hide, leaving a raw UUID in the table.
    const { data: prods } = await supabaseAdmin().from('products').select('id, brand, name, slug').in('id', topIds);
    for (const p of (prods ?? []) as Array<{ id: string; brand: string; name: string; slug: string }>) {
      productMap.set(p.id, { brand: p.brand, name: p.name, slug: p.slug });
    }
  }

  // Chart data adapter (RevenueChart expects [{ date, revenue }]), rolled up to
  // the chosen Day / Week / Month granularity.
  const chartData = rollUp(daily, gran);

  // ── New vs returning customers ── split the double-window rows by DATE
  // (the RPC may skip empty days, so slicing by index could misalign the two
  // windows; the zero-filled daily series gives the boundary day).
  const windowStart = daily[0]?.day ? String(daily[0].day).slice(0, 10) : '';
  const retRows = returning2x.map(r => ({ ...r, day: String(r.day).slice(0, 10) }));
  const retCur = windowStart ? retRows.filter(r => r.day >= windowStart) : retRows;
  const retPrev = windowStart ? retRows.filter(r => r.day < windowStart) : [];
  const aggSplit = (rows: { new_orders: number; new_revenue: number; returning_orders: number; returning_revenue: number }[]) =>
    rows.reduce((a, r) => ({
      newOrders: a.newOrders + Number(r.new_orders), newRev: a.newRev + Number(r.new_revenue),
      retOrders: a.retOrders + Number(r.returning_orders), retRev: a.retRev + Number(r.returning_revenue),
    }), { newOrders: 0, newRev: 0, retOrders: 0, retRev: 0 });
  const curSplit = aggSplit(retCur);
  const prevSplit = aggSplit(retPrev);
  const curSplitOrders = curSplit.newOrders + curSplit.retOrders;
  const prevSplitOrders = prevSplit.newOrders + prevSplit.retOrders;
  const returningRate = curSplitOrders > 0 ? curSplit.retOrders / curSplitOrders : 0;
  const prevReturningRate = prevSplitOrders > 0 ? prevSplit.retOrders / prevSplitOrders : 0;
  const returningRateDelta = prevReturningRate > 0 ? pctDelta(returningRate * 100, prevReturningRate * 100) : null;
  const curSplitRev = curSplit.newRev + curSplit.retRev;
  const prevSplitRev = prevSplit.newRev + prevSplit.retRev;
  const retShare = curSplitRev > 0 ? Math.round((curSplit.retRev / curSplitRev) * 100) : 0;
  const prevRetShare = prevSplitRev > 0 ? Math.round((prevSplit.retRev / prevSplitRev) * 100) : 0;
  // Stacked-chart buckets on the same Day/Week/Month grouping as the revenue
  // chart, seeded from the zero-filled daily series so no-sale buckets render.
  const nrBuckets: NewReturningBucket[] = (() => {
    const map = new Map<string, { newRev: number; retRev: number }>();
    for (const d of daily) {
      const k = bucketKey(String(d.day).slice(0, 10), gran);
      if (!map.has(k)) map.set(k, { newRev: 0, retRev: 0 });
    }
    for (const r of retCur) {
      const k = bucketKey(r.day, gran);
      const cur = map.get(k) ?? { newRev: 0, retRev: 0 };
      cur.newRev += Number(r.new_revenue) || 0;
      cur.retRev += Number(r.returning_revenue) || 0;
      map.set(k, cur);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }));
  })();

  // Items per order (window-scoped): avg units per order, avg distinct lines.
  const avgUnits = Number(unitsRow?.avg_units) || 0;
  const avgLines = Number(unitsRow?.avg_lines) || 0;

  // Sales by city: top 10 by revenue; shares are of the WHOLE window's
  // regional revenue so the bars read as true shares, not shares-of-top-10.
  const topRegions = byRegion.slice(0, 10);
  const regionTotalRev = byRegion.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
  const maxRegionRev = Math.max(1, ...topRegions.map(r => Number(r.revenue) || 0));

  // ── "What stands out" callouts, computed from the same window data the
  // charts show. Only sentences the data actually supports.
  const salesInsights: string[] = [];
  const revDelta = pctDelta(curRev, prevRev);
  if (prevRev > 0 && revDelta != null && curRev !== prevRev) {
    salesInsights.push(`Revenue is ${revDelta >= 0 ? 'up' : 'down'} ${Math.abs(revDelta)}% vs the prior ${window} days (${fmt(curRev)} vs ${fmt(prevRev)}).`);
  }
  if (top.length > 0 && curRev > 0) {
    // The RPC sorts by units; the "one product carries the store" reading
    // needs the top earner instead.
    const t0 = [...top].sort((a, b) => Number(b.revenue) - Number(a.revenue))[0];
    const p = productMap.get(t0.product_id);
    const share = Math.round((Number(t0.revenue) / curRev) * 100);
    if (p && share >= 10) {
      salesInsights.push(`${brandPlusName(p.brand, p.name)} alone drove ${share}% of this window's revenue (${fmt(Number(t0.revenue))}).`);
    }
  }
  const aovDelta = pctDelta(curAov, prevAov);
  if (prevAov > 0 && aovDelta != null && Math.abs(aovDelta) >= 10) {
    salesInsights.push(`Average order value ${aovDelta >= 0 ? 'rose' : 'fell'} ${Math.abs(aovDelta)}% — ${aovDelta >= 0 ? 'baskets are getting bigger' : 'more small orders in the mix'}.`);
  }
  // Returning-share shift: only worth a sentence when both windows have
  // revenue and the share actually moved (3+ points).
  if (curSplitRev > 0 && prevSplitRev > 0 && Math.abs(retShare - prevRetShare) >= 3) {
    salesInsights.push(`Returning customers drove ${retShare}% of revenue, ${retShare > prevRetShare ? 'up' : 'down'} from ${prevRetShare}% in the prior ${window} days.`);
  }

  const customerInsights: string[] = [];
  if (kpis && Number(kpis.repeat_purchase_rate) > 0) {
    customerInsights.push(`${pct(Number(kpis.repeat_purchase_rate))} of your lifetime customers have come back for a second order.`);
  }
  if (rfm.length > 0) {
    const topSeg = [...rfm].sort((a, b) => Number(b.total_revenue) - Number(a.total_revenue))[0];
    if (Number(topSeg.total_revenue) > 0) {
      customerInsights.push(`Your most valuable segment is “${topSeg.segment}” — ${topSeg.customers} customer${topSeg.customers === 1 ? '' : 's'} worth ${fmt(Number(topSeg.total_revenue))} lifetime.`);
    }
  }

  // Cohort heat-map: rows = cohort_month, cols = month_offset.
  const cohortMatrix = (() => {
    const months = Array.from(new Set(cohort.map(c => c.cohort_month))).sort();
    const offsets = Array.from(new Set(cohort.map(c => c.month_offset))).sort((a, b) => a - b);
    const lookup = new Map<string, number>();
    for (const c of cohort) lookup.set(`${c.cohort_month}:${c.month_offset}`, c.customers);
    return { months, offsets, lookup };
  })();
  const maxCohortCount = Math.max(1, ...cohort.map(c => c.customers));

  const statusTotal = byStatus.reduce((s, x) => s + x.count, 0) || 1;

  // ── Sources tab: sales attribution from the order's own captured UTM /
  // referrer / landing-page fields (service-role read; orders RLS blocks anon).
  // Only queried when the tab is active so the other tabs pay nothing.
  type SrcAgg = { key: string; orders: number; revenue: number };
  let bySource: SrcAgg[] = [];
  let byCampaign: SrcAgg[] = [];
  let byLanding: SrcAgg[] = [];
  const attrTotals = { orders: 0, revenue: 0, untaggedOrders: 0, untaggedRevenue: 0 };
  let waClicks = 0;
  if (tab === 'sources') {
    // Async server component renders once per request; Date.now() is fine here
    // (see the same pattern on dashboard/page.tsx). The purity rule targets
    // client components the React Compiler may re-render.
    // eslint-disable-next-line react-hooks/purity
    const sinceIso = new Date(Date.now() - window * 86_400_000).toISOString();
    const { data: attrRaw } = await supabaseAdmin()
      .from('orders')
      .select('utm_source, utm_medium, utm_campaign, referrer, landing_page, total, status, created_at')
      .is('archived_at', null)
      .gte('created_at', sinceIso);
    const rows = ((attrRaw ?? []) as (AttrOrder & { created_at: string })[])
      // Same no-revenue states as everywhere else (see finance.ts
      // DEAD_STATES): returned COD parcels and unconfirmed-payment orders
      // must not credit revenue to a source.
      .filter(o => !['cancelled', 'canceled', 'refunded', 'returned', 'payment_pending', 'payment_failed'].includes((o.status ?? '').toLowerCase()));
    const acc = (map: Map<string, SrcAgg>, key: string, rev: number) => {
      const k = key || '—';
      const cur = map.get(k) ?? { key: k, orders: 0, revenue: 0 };
      cur.orders += 1; cur.revenue += rev; map.set(k, cur);
    };
    const srcMap = new Map<string, SrcAgg>(), campMap = new Map<string, SrcAgg>(), landMap = new Map<string, SrcAgg>();
    for (const o of rows) {
      const rev = Number(o.total) || 0;
      const ch = channelOf(o);
      acc(srcMap, ch, rev);
      const camp = (o.utm_campaign ?? '').trim();
      if (camp) acc(campMap, camp.toLowerCase(), rev);
      const land = (o.landing_page ?? '').trim();
      if (land) { try { acc(landMap, new URL(land).pathname || land, rev); } catch { acc(landMap, land.slice(0, 60), rev); } }
      attrTotals.orders += 1; attrTotals.revenue += rev;
      if (ch === UNTAGGED) { attrTotals.untaggedOrders += 1; attrTotals.untaggedRevenue += rev; }
    }
    const sortRev = (a: SrcAgg, b: SrcAgg) => b.revenue - a.revenue || b.orders - a.orders;
    bySource = [...srcMap.values()].sort(sortRev);
    byCampaign = [...campMap.values()].sort(sortRev);
    byLanding = [...landMap.values()].sort(sortRev).slice(0, 10);
    // WhatsApp-order intent: clicks on the storefront "Chat/Order on WhatsApp"
    // buttons (logged by the /go/whatsapp redirect). Many PK shoppers order via
    // WhatsApp rather than on-site checkout, so this is a real funnel signal
    // that would otherwise be invisible.
    const { count } = await supabaseAdmin()
      .from('whatsapp_clicks').select('id', { count: 'exact', head: true }).gte('created_at', sinceIso);
    waClicks = count ?? 0;
  }
  const maxSourceRev = Math.max(1, ...bySource.map(s => s.revenue));
  const untaggedPct = attrTotals.revenue > 0 ? Math.round((attrTotals.untaggedRevenue / attrTotals.revenue) * 100) : 0;

  const cardStyle = { background: 'white', borderRadius: 10, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } as const;
  const headingStyle = { margin: '0 0 16px', fontSize: '0.875rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' } as const;

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Analytics</h1>
          {/* The date range drives Sales, Customers, Sources and now Traffic
              (Search Console, GA4, SEO trend and Web Vitals all honour it).
              Only Funnels keeps fixed PostHog windows, so the picker stays
              hidden there rather than implying a control that does nothing. */}
          {(tab === 'sales' || tab === 'customers' || tab === 'sources' || tab === 'traffic') && (
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
              Showing the last {window} days
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {canRefresh && <RefreshAnalyticsButton />}
          {/* Shared URL-synced range picker (same control as the other insight
              surfaces); preserves the active tab via the query string. */}
          {(tab === 'sales' || tab === 'customers' || tab === 'sources' || tab === 'traffic') && (
            <Suspense fallback={null}>
              <RangePicker
                value={String(window)}
                options={[
                  { value: '7', label: '7 days' },
                  { value: '30', label: '30 days' },
                  { value: '90', label: '90 days' },
                  { value: '365', label: '1 year' },
                ]}
              />
            </Suspense>
          )}
          {/* Day / Week / Month grouping for the revenue chart (Sales tab). */}
          {tab === 'sales' && (
            <Suspense fallback={null}>
              <RangePicker
                param="g"
                ariaLabel="Group revenue by"
                value={gran}
                options={[
                  { value: 'day', label: 'Daily' },
                  { value: 'week', label: 'Weekly' },
                  { value: 'month', label: 'Monthly' },
                ]}
              />
            </Suspense>
          )}
        </div>
      </div>

      {/* Question tabs: Sales / Customers / Traffic / Funnels. */}
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 28, flexWrap: 'wrap' }}>
        {TABS.filter(t => !t.traffic || canTraffic).map(t => {
          const active = tab === t.key;
          return (
            <Link
              key={t.key}
              role="tab"
              aria-selected={active}
              href={`/admin/analytics?tab=${t.key}&days=${window}`}
              style={{
                padding: '10px 18px', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none',
                color: active ? '#C5286A' : '#6b7280',
                borderBottom: active ? '2px solid #C5286A' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {tab === 'sales' && (
        <>
          <InsightCallouts items={salesInsights} />

          {/* Sales KPIs — headline, sparkline and delta all from the same
              double-window daily series, so they can't disagree. The two
              customer-mix cards (returning rate, items per order) come from
              the analytics_returning_split / analytics_units_per_order RPCs
              on the same window. */}
          <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 28 }}>
            <KpiCard label={`Revenue · last ${window} days`} value={fmt(curRev)} accent="#10b981"
              spark={daily.map(d => Number(d.revenue))}
              delta={prevRev > 0 && revDelta != null ? { pct: revDelta, goodWhenUp: true, vs: vsLabel } : null}
              hint={kpis ? `Lifetime: ${fmt(kpis.lifetime_revenue)}` : undefined} />
            <KpiCard label="Orders" value={String(curOrders)} accent="#C5286A" href={ordersHref}
              spark={daily.map(d => Number(d.orders))}
              delta={prevOrders > 0 && pctDelta(curOrders, prevOrders) != null ? { pct: pctDelta(curOrders, prevOrders)!, goodWhenUp: true, vs: vsLabel } : null}
              hint={kpis ? `Lifetime: ${kpis.lifetime_orders}` : undefined} />
            <KpiCard label="AOV (avg order value)" value={fmt(curAov)} accent="#6366f1"
              spark={daily.map(d => Number(d.aov))}
              delta={prevAov > 0 && aovDelta != null ? { pct: aovDelta, goodWhenUp: true, vs: vsLabel } : null} />
            <KpiCard label="Returning customer rate" value={pct(returningRate)} accent="#0ea5e9"
              delta={returningRateDelta != null ? { pct: returningRateDelta, goodWhenUp: true, vs: vsLabel } : null}
              hint={`${curSplit.retOrders} of ${curSplitOrders} order${curSplitOrders === 1 ? '' : 's'} from repeat customers`} />
            <KpiCard label="Items per order" value={avgUnits > 0 ? avgUnits.toFixed(1) : '—'} accent="#f59e0b"
              hint={avgLines > 0 ? `${avgLines.toFixed(1)} distinct product${avgLines >= 1.05 ? 's' : ''} per order` : undefined} />
          </div>

          {/* Revenue chart — grouped by the chosen Day/Week/Month bucket */}
          <div style={{ ...cardStyle, marginBottom: 28 }}>
            <h2 style={headingStyle}>Revenue · {gran === 'day' ? 'daily' : gran === 'week' ? 'weekly' : 'monthly'} · last {window} days</h2>
            <RevenueChart days={chartData} granularity={gran} />
          </div>

          {/* New vs returning — who the revenue comes from, stacked on the
              same Day/Week/Month grouping as the revenue chart above. */}
          <div style={{ ...cardStyle, marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <h2 style={{ ...headingStyle, margin: 0 }}>New vs returning customers · last {window} days</h2>
              {curSplitRev > 0 && (
                <span style={{ fontSize: '0.8125rem', color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
                  New <b style={{ color: '#111827' }}>{fmt(curSplit.newRev)}</b> · Returning <b style={{ color: '#111827' }}>{fmt(curSplit.retRev)}</b>
                  {' '}<span style={{ color: '#9ca3af' }}>({retShare}% of revenue from returning)</span>
                </span>
              )}
            </div>
            <NewReturningChart buckets={nrBuckets} granularity={gran} />
          </div>

          <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            {/* Orders by status — lifecycle colours shared with every other
                status surface; each row drills into the filtered list. */}
            <div style={cardStyle}>
              <h2 style={headingStyle}>Orders by status · all time</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {byStatus.map(s => {
                  const p = (s.count / statusTotal) * 100;
                  const color = ORDER_STATUS_COLORS[s.status as OrderStatus] ?? '#C5286A';
                  return (
                    <Link key={s.status} href={`/admin/orders?status=${s.status}`} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.8125rem', textDecoration: 'none' }}>
                      <span style={{ width: 120, color: '#374151' }}>{ORDER_STATUS_LABELS[s.status as OrderStatus] ?? s.status}</span>
                      <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${p}%`, height: '100%', background: color }} />
                      </div>
                      <span style={{ width: 50, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#111827', fontWeight: 600 }}>{s.count}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Top products */}
            <div style={cardStyle}>
              <h2 style={headingStyle}>Top products · last {window} days</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <th scope="col" style={{ textAlign: 'left',  padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Product</th>
                    <th scope="col" style={{ textAlign: 'right', padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Units</th>
                    <th scope="col" style={{ textAlign: 'right', padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map(t => {
                    const p = productMap.get(t.product_id);
                    return (
                      <tr key={t.product_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 0' }}>
                          {p ? (
                            <Link href={`/admin/products/${t.product_id}`} style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>
                              {brandPlusName(p.brand, p.name)}
                            </Link>
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: '0.8125rem', fontStyle: 'italic' }}>Unknown product (deleted)</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.units}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(t.revenue))}</td>
                      </tr>
                    );
                  })}
                  {top.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: '12px 0', textAlign: 'center', color: '#9ca3af' }}>No order data in this window yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sales by city — top 10 by revenue, same share-bar language as
              Revenue by source on the Sources tab. 'Unknown' is the bucket
              for orders whose address never captured a city. */}
          <div style={{ ...cardStyle, marginBottom: 28 }}>
            <h2 style={headingStyle}>Sales by city · last {window} days</h2>
            {topRegions.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.8125rem', margin: 0 }}>No orders in this window yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topRegions.map(r => {
                  const rev = Number(r.revenue) || 0;
                  const w = (rev / maxRegionRev) * 100;
                  const share = regionTotalRev > 0 ? Math.round((rev / regionTotalRev) * 100) : 0;
                  const unknown = r.city === 'Unknown';
                  return (
                    <div key={`${r.city}|${r.province ?? ''}`} style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: '0.8125rem', color: unknown ? '#b45309' : '#374151', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }} title={r.province ? `${r.city}, ${r.province}` : r.city}>
                        {r.city}{r.province && <span style={{ color: '#9ca3af', fontWeight: 500 }}> · {r.province}</span>}
                      </span>
                      <div style={{ height: 16, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(3, w)}%`, height: '100%', background: unknown ? '#f59e0b' : '#C5286A', borderRadius: 5 }} />
                      </div>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#111827', minWidth: 120, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(rev)} <span style={{ color: '#9ca3af', fontWeight: 500 }}>
                          · {r.orders} order{Number(r.orders) === 1 ? '' : 's'} · {share}%
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'sources' && (
        <>
          {/* Sales attribution from each order's own captured source. This is
              the "where does my revenue come from" view — distinct from the
              PostHog traffic widgets on the Traffic/Funnels tabs. */}
          <p style={{ margin: '0 0 20px', fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.55, maxWidth: 720 }}>
            This shows where the <b>money</b> comes from — every order traced back to the link or site that sent the customer.
            &ldquo;Untagged / Direct&rdquo; means we couldn&apos;t tell (usually an Instagram or WhatsApp link with no tag). Tag your
            links in the <Link href="/admin/link-builder" style={{ color: '#C5286A', fontWeight: 600 }}>Link builder</Link> to shrink it.
          </p>
          <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <KpiCard label={`Attributed orders · last ${window} days`} value={String(attrTotals.orders)} accent="#C5286A"
              hint={`${fmt(attrTotals.revenue)} revenue`} />
            <KpiCard label="Distinct sources" value={String(bySource.length)} accent="#6366f1"
              hint="Tagged links + referrers + direct" />
            <KpiCard label="Untagged / Direct" value={`${untaggedPct}%`} accent={untaggedPct >= 50 ? '#f59e0b' : '#10b981'}
              hint="Share of revenue with no source" />
            <KpiCard label="WhatsApp clicks" value={String(waClicks)} accent="#25D366"
              hint="“Chat/Order on WhatsApp” taps" />
          </div>

          {untaggedPct >= 40 && attrTotals.orders > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 18px', marginBottom: 24, fontSize: '0.875rem', color: '#92400e', lineHeight: 1.55 }}>
              <b>{untaggedPct}% of revenue has no source.</b> That&apos;s traffic from Instagram, WhatsApp and in-app browsers arriving
              without a tag — so it can&apos;t be credited to a channel. Build tagged links in the{' '}
              <Link href="/admin/link-builder" style={{ color: '#C5286A', fontWeight: 700 }}>Link builder</Link> and this shrinks over time.
            </div>
          )}

          <div style={{ ...cardStyle, marginBottom: 24 }}>
            <h2 style={headingStyle}>Revenue by source · last {window} days</h2>
            {bySource.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.8125rem', margin: 0 }}>No orders in this window yet. Widen the range or check back after your next sale.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {bySource.map(s => {
                  const w = (s.revenue / maxSourceRev) * 100;
                  const untagged = s.key === UNTAGGED;
                  return (
                    <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: '0.8125rem', color: untagged ? '#b45309' : '#374151', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }} title={s.key}>{s.key}</span>
                      <div style={{ height: 16, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(3, w)}%`, height: '100%', background: untagged ? '#f59e0b' : '#C5286A', borderRadius: 5 }} />
                      </div>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#111827', minWidth: 120, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(s.revenue)} <span style={{ color: '#9ca3af', fontWeight: 500 }}>
                          · {s.orders} order{s.orders === 1 ? '' : 's'}
                          {attrTotals.revenue > 0 && ` · ${Math.round((s.revenue / attrTotals.revenue) * 100)}%`}
                          {s.orders > 0 && ` · AOV ${fmt(Math.round(s.revenue / s.orders))}`}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            <div style={cardStyle}>
              <h2 style={headingStyle}>By campaign</h2>
              {byCampaign.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '0.8125rem', margin: 0 }}>No campaign tags on any order yet. Add a campaign name in the Link builder (e.g. <em>eid-sale</em>) to break results down here.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead><tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <th scope="col" style={{ textAlign: 'left', padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Campaign</th>
                    <th scope="col" style={{ textAlign: 'right', padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Orders</th>
                    <th scope="col" style={{ textAlign: 'right', padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Revenue</th>
                  </tr></thead>
                  <tbody>
                    {byCampaign.map(c => (
                      <tr key={c.key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 0', color: '#111827', fontWeight: 600 }}>{c.key}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.orders}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={cardStyle}>
              <h2 style={headingStyle}>Top landing pages</h2>
              {byLanding.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '0.8125rem', margin: 0 }}>No landing-page data captured on orders in this window yet.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead><tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <th scope="col" style={{ textAlign: 'left', padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>First page</th>
                    <th scope="col" style={{ textAlign: 'right', padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Orders</th>
                    <th scope="col" style={{ textAlign: 'right', padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Revenue</th>
                  </tr></thead>
                  <tbody>
                    {byLanding.map(l => (
                      <tr key={l.key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 0', color: '#111827', fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.key}>{l.key}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{l.orders}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(l.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'customers' && (
        <>
          <InsightCallouts items={customerInsights} />

          {/* Customer KPIs */}
          <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 28, maxWidth: 560 }}>
            <KpiCard label="Unique customers" value={kpis ? String(kpis.unique_customers) : '—'} accent="#0ea5e9"
              href="/admin/users" hint={`Last ${window} days`} />
            {/* Explicitly lifetime — this KPI ignores the range picker, and
                the label must say so instead of implying it is windowed. */}
            <KpiCard label="Repeat purchase rate · lifetime" value={kpis ? pct(Number(kpis.repeat_purchase_rate)) : '—'} accent="#6366f1"
              hint="Lifetime customers with 2+ orders, all time" />
          </div>

          <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            {/* RFM segments */}
            <div style={cardStyle}>
              <h2 style={headingStyle}>Customer segments</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <th scope="col" style={{ textAlign: 'left',  padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Segment</th>
                    <th scope="col" style={{ textAlign: 'right', padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Customers</th>
                    <th scope="col" style={{ textAlign: 'right', padding: '6px 0', color: '#6b7280', fontWeight: 600 }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {rfm.map(r => (
                    <tr key={r.segment} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 0', color: '#111827', fontWeight: 600 }}>{r.segment}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.customers}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(r.total_revenue))}</td>
                    </tr>
                  ))}
                  {rfm.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: '12px 0', textAlign: 'center', color: '#9ca3af' }}>No customer data yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Cohort retention heat-map */}
            <div style={cardStyle}>
              <h2 style={{ margin: '0 0 6px', fontSize: '0.875rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Cohort retention · last 6 months
              </h2>
              <p style={{ margin: '0 0 12px', fontSize: '0.6875rem', color: '#9ca3af' }}>
                Rows = month of customer&apos;s first order. Columns = months since.
              </p>
              {cohortMatrix.months.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>Not enough data yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr>
                        <th scope="col" style={{ padding: '4px 8px', textAlign: 'left', color: '#6b7280' }}>Cohort</th>
                        {cohortMatrix.offsets.map(o => (
                          <th scope="col" key={o} style={{ padding: '4px 6px', color: '#6b7280', fontWeight: 600 }}>+{o}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cohortMatrix.months.map(m => (
                        <tr key={m}>
                          <td style={{ padding: '4px 8px', color: '#111827', fontWeight: 600 }}>
                            {new Date(m).toLocaleDateString('en-PK', { month: 'short', year: '2-digit', timeZone: PK_TZ })}
                          </td>
                          {cohortMatrix.offsets.map(o => {
                            const v = cohortMatrix.lookup.get(`${m}:${o}`) ?? 0;
                            const opacity = v === 0 ? 0 : 0.15 + (v / maxCohortCount) * 0.85;
                            return (
                              <td key={o} style={{
                                padding: '4px 6px', textAlign: 'center',
                                background: `rgba(236, 72, 153, ${opacity})`,
                                color: opacity > 0.5 ? 'white' : '#111827',
                                fontVariantNumeric: 'tabular-nums', minWidth: 30,
                              }}>
                                {v > 0 ? v : ''}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'traffic' && canTraffic && (
        <>
          {/* ── Search & discovery ── the interactive Traffic & Search
              dashboard (GA4 channel growth, share donut, GSC performance,
              top queries/pages, indexing). It carries its own 7/30/90-day
              pills and slices a 180-day server payload client-side, so
              range switches are instant. */}
          <TrafficSection title="Search & discovery" hint="Google Analytics + Search Console, interactive">
            <TrafficSearchDashboard data={await getTrafficSearchData()} />
          </TrafficSection>

          {/* ── Bing ── the second engine (and DuckDuckGo/Yahoo/Copilot behind
              it), read from Bing Webmaster Tools on each analytics refresh. */}
          <TrafficSection title="Bing search" hint="Bing Webmaster Tools, last 28 days (refreshed with the analytics cache)">
            <BingSearchWidget />
          </TrafficSection>

          {/* ── Site performance ── real field Core Web Vitals (p75), also
              range-aware. */}
          <TrafficSection title="Site performance" hint={`Real-visitor Core Web Vitals (p75), last ${window} days`}>
            <WebVitalsWidget days={window} />
          </TrafficSection>

          {/* ── On-site behaviour ── PostHog page/event/device/engagement
              panels. These read the daily 7-day snapshot (each card captions
              its own window), so they stay fixed regardless of the picker. */}
          <TrafficSection title="On-site behaviour" hint="Who's browsing, how they engage, and where they land (rolling 7-day snapshot)">
            <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <TopPagesWidget />
              <TopEventsWidget />
            </div>
            <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <DeviceBrowserWidget />
              <EngagementWidget />
            </div>
            <GeographyWidget />
          </TrafficSection>

          {/* ── Demand ── what shoppers search for and which products pull
              views but not carts. Rolling 7-day PostHog snapshot. */}
          <TrafficSection title="Demand & product interest" hint="What shoppers search for, and views-vs-carts by product (rolling 7-day snapshot)">
            <ShoppingIntentWidget />
          </TrafficSection>
        </>
      )}

      {tab === 'funnels' && canTraffic && (
        <>
          {/* Framing: these are PostHog behaviour funnels (browse → buy). The
              money-side of "where sales come from" lives on the Sources tab;
              tie them together so the two aren't read in isolation. */}
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', marginBottom: 24, fontSize: '0.8125rem', color: '#4b5563', lineHeight: 1.55 }}>
            <b style={{ color: '#111827' }}>How to read this:</b> these funnels track on-site behaviour — how visitors move from browsing to buying, and where they drop off. To see which <em>sources</em> the revenue comes from, use the{' '}
            <Link href={`/admin/analytics?tab=sources&days=${window}`} style={{ color: '#C5286A', fontWeight: 700 }}>Sources</Link> tab; to make new traffic traceable, the{' '}
            <Link href="/admin/link-builder" style={{ color: '#C5286A', fontWeight: 700 }}>Link builder</Link>. Widgets need a completed analytics refresh to populate.
          </div>
          <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 28 }}>
            <ConversionFunnelWidget />
            <PostHogWidget />
          </div>
          <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            <FunnelBySourceWidget />
            <FunnelByDeviceWidget />
          </div>
          {/* User-journey widgets: sessions, paths, retention curve, and
              PostHog session recordings. */}
          <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 28 }}>
            <UserJourneysWidget />
            <RetentionWidget />
          </div>
          <div style={{ marginBottom: 28 }}>
            <SessionRecordingsWidget />
          </div>
        </>
      )}
    </div>
  );
}
