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
import { UserJourneysWidget } from '@/components/admin/UserJourneysWidget';
import { FunnelBySourceWidget } from '@/components/admin/FunnelBySourceWidget';
import { FunnelByDeviceWidget } from '@/components/admin/FunnelByDeviceWidget';
import { RetentionWidget } from '@/components/admin/RetentionWidget';
import { SessionRecordingsWidget } from '@/components/admin/SessionRecordingsWidget';
import { SearchConsoleWidget } from '@/components/admin/SearchConsoleWidget';
import { Ga4Widget } from '@/components/admin/Ga4Widget';
import { WebVitalsWidget } from '@/components/admin/WebVitalsWidget';
import { SeoTrendWidget } from '@/components/admin/SeoTrendWidget';
import { RefreshAnalyticsButton } from '@/components/admin/RefreshAnalyticsButton';
import { RangePicker } from '@/components/admin/insights/RangePicker';
import { KpiCard } from '@/components/admin/insights/KpiCard';
import { InsightCallouts } from '@/components/admin/insights/InsightCallouts';
import { pctDelta } from '@/components/admin/insights/format';
import { ORDER_STATUS_COLORS } from '@/components/admin/OrderStatusBadge';
import { brandPlusName } from '@/lib/product-display';
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
type Tab = 'sales' | 'customers' | 'traffic' | 'funnels';
const TABS: { key: Tab; label: string; traffic?: boolean }[] = [
  { key: 'sales', label: 'Sales' },
  { key: 'customers', label: 'Customers' },
  { key: 'traffic', label: 'Traffic', traffic: true },
  { key: 'funnels', label: 'Funnels', traffic: true },
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; tab?: string }>;
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

  // Double-window daily series: the last `window` days are the charts/KPIs,
  // the `window` days before them are the delta baseline — one source for
  // headline, sparkline and trend pill, so they can never disagree.
  const [daily2x, kpis, byStatus, top, rfm, cohort] = await Promise.all([
    rpc<DailyRow>('analytics_daily', { p_days: window * 2 }),
    rpc<KpiRow>('analytics_kpis', { p_days: window }).then(rows => rows[0]),
    rpc<StatusRow>('analytics_orders_by_status'),
    rpc<TopRow>('analytics_top_products', { p_days: window, p_limit: 10 }),
    rpc<RfmRow>('analytics_rfm_segments'),
    rpc<CohortRow>('analytics_cohort_retention', { p_months: 6 }),
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

  // Chart data adapter (RevenueChart already expects [{ date, revenue }]).
  const chartData = daily.map(d => ({ date: d.day, revenue: Number(d.revenue) }));

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

  const cardStyle = { background: 'white', borderRadius: 10, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } as const;
  const headingStyle = { margin: '0 0 16px', fontSize: '0.875rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' } as const;

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Analytics</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
            Showing the last {window} days
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {canRefresh && <RefreshAnalyticsButton />}
          {/* Shared URL-synced range picker (same control as the other insight
              surfaces); preserves the active tab via the query string. */}
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
              double-window daily series, so they can't disagree. */}
          <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
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
          </div>

          {/* Revenue chart */}
          <div style={{ ...cardStyle, marginBottom: 28 }}>
            <h2 style={headingStyle}>Revenue · last {window} days</h2>
            <RevenueChart days={chartData} />
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
        </>
      )}

      {tab === 'customers' && (
        <>
          <InsightCallouts items={customerInsights} />

          {/* Customer KPIs */}
          <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 28, maxWidth: 560 }}>
            <KpiCard label="Unique customers" value={kpis ? String(kpis.unique_customers) : '—'} accent="#0ea5e9"
              href="/admin/users" hint={`Last ${window} days`} />
            <KpiCard label="Repeat-purchase rate" value={kpis ? pct(Number(kpis.repeat_purchase_rate)) : '—'} accent="#6366f1"
              hint="Lifetime customers with 2+ orders" />
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
          {/* SEO trend over time (GSC + GA4 daily series) — answers
              "is organic traffic / indexation improving?". */}
          <div style={{ marginBottom: 28 }}>
            <SeoTrendWidget days={90} />
          </div>
          {/* Live Google Search Console + GA4 (only render once connected). */}
          <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            <SearchConsoleWidget />
            <Ga4Widget />
          </div>
          {/* Real Core Web Vitals (field p75) captured in-app, honours the
              day-range pills above. */}
          <div style={{ marginBottom: 28 }}>
            <WebVitalsWidget days={window} />
          </div>
          <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            <TopPagesWidget />
            <TopEventsWidget />
          </div>
        </>
      )}

      {tab === 'funnels' && canTraffic && (
        <>
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
