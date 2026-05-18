export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { ORDER_STATUS_LABELS } from '@/types';
import type { OrderStatus } from '@/types';

const fmt = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

interface DailyRow { day: string; orders: number; revenue: number; aov: number }
interface KpiRow { total_orders: number; total_revenue: number; aov: number; unique_customers: number; repeat_purchase_rate: number; lifetime_orders: number; lifetime_revenue: number }
interface StatusRow { status: string; count: number }
interface TopRow { product_id: string; units: number; revenue: number }
interface RfmRow { segment: string; customers: number; total_revenue: number }
interface CohortRow { cohort_month: string; month_offset: number; customers: number }

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T[]> {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) {
    const { log } = await import('@/lib/logger');
    log.warn('analytics.rpc_failed', { rpc: name, message: error.message });
    return [];
  }
  return (data ?? []) as T[];
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('analytics')) {
    return <NoAccess section="Analytics" />;
  }

  const { days } = await searchParams;
  const window = Math.max(1, Math.min(365, Number(days ?? '30')));

  const [daily, kpis, byStatus, top, rfm, cohort, topProductDetails] = await Promise.all([
    rpc<DailyRow>('analytics_daily', { p_days: window }),
    rpc<KpiRow>('analytics_kpis', { p_days: window }).then(rows => rows[0]),
    rpc<StatusRow>('analytics_orders_by_status'),
    rpc<TopRow>('analytics_top_products', { p_days: window, p_limit: 10 }),
    rpc<RfmRow>('analytics_rfm_segments'),
    rpc<CohortRow>('analytics_cohort_retention', { p_months: 6 }),
    // Resolve product names for the top-products table in one extra round-trip.
    Promise.resolve(null),
  ]);

  // Map top product ids → product details.
  const topIds = top.map(t => t.product_id);
  let productMap = new Map<string, { brand: string; name: string; slug: string }>();
  if (topIds.length) {
    const { data: prods } = await supabase.from('products').select('id, brand, name, slug').in('id', topIds);
    for (const p of (prods ?? []) as Array<{ id: string; brand: string; name: string; slug: string }>) {
      productMap.set(p.id, { brand: p.brand, name: p.name, slug: p.slug });
    }
  }
  void topProductDetails;

  // Chart data adapter (RevenueChart already expects [{ date, revenue }]).
  const chartData = daily.map(d => ({ date: d.day, revenue: Number(d.revenue) }));

  const kpiCards: { label: string; value: string; sub?: string }[] = kpis
    ? [
        { label: `Revenue · last ${window} days`, value: fmt(kpis.total_revenue), sub: `Lifetime: ${fmt(kpis.lifetime_revenue)}` },
        { label: 'Orders', value: String(kpis.total_orders), sub: `Lifetime: ${kpis.lifetime_orders}` },
        { label: 'AOV (avg order value)', value: fmt(kpis.aov) },
        { label: 'Unique customers', value: String(kpis.unique_customers) },
        { label: 'Repeat-purchase rate', value: pct(Number(kpis.repeat_purchase_rate)), sub: 'Lifetime customers with 2+ orders' },
      ]
    : [];

  // Cohort heat-map: rows = cohort_month, cols = month_offset.
  const cohortMatrix = (() => {
    const months = Array.from(new Set(cohort.map(c => c.cohort_month))).sort();
    const offsets = Array.from(new Set(cohort.map(c => c.month_offset))).sort((a, b) => a - b);
    const lookup = new Map<string, number>();
    for (const c of cohort) lookup.set(`${c.cohort_month}:${c.month_offset}`, c.customers);
    return { months, offsets, lookup };
  })();
  const maxCohortCount = Math.max(1, ...cohort.map(c => c.customers));

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Analytics</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
            Time window: last {window} days · <Link href="/admin/analytics?days=7" style={{ color: '#ec4899' }}>7d</Link> · <Link href="/admin/analytics?days=30" style={{ color: '#ec4899' }}>30d</Link> · <Link href="/admin/analytics?days=90" style={{ color: '#ec4899' }}>90d</Link> · <Link href="/admin/analytics?days=365" style={{ color: '#ec4899' }}>1y</Link>
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 28 }}>
        {kpiCards.map(k => (
          <div key={k.label} style={{ background: 'white', borderRadius: 10, padding: '18px 20px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: 4 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div style={{ background: 'white', borderRadius: 10, padding: '24px', border: '1px solid #e5e7eb', marginBottom: 28 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.875rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Revenue · last {window} days
        </h2>
        <RevenueChart days={chartData} />
      </div>

      <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        {/* Orders by status */}
        <div style={{ background: 'white', borderRadius: 10, padding: '24px', border: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '0.875rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Orders by status
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {byStatus.map(s => {
              const total = byStatus.reduce((sum, x) => sum + x.count, 0) || 1;
              const p = (s.count / total) * 100;
              return (
                <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.8125rem' }}>
                  <span style={{ width: 120, color: '#374151' }}>{ORDER_STATUS_LABELS[s.status as OrderStatus] ?? s.status}</span>
                  <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${p}%`, height: '100%', background: '#ec4899' }} />
                  </div>
                  <span style={{ width: 50, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#111827', fontWeight: 600 }}>{s.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RFM segments */}
        <div style={{ background: 'white', borderRadius: 10, padding: '24px', border: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '0.875rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Customer segments · last 12 months
          </h2>
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
      </div>

      <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        {/* Top products */}
        <div style={{ background: 'white', borderRadius: 10, padding: '24px', border: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '0.875rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Top products · last {window} days
          </h2>
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
                          {p.brand} {p.name}
                        </Link>
                      ) : (
                        <span style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: '0.75rem' }}>{t.product_id.slice(0, 8)}…</span>
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

        {/* Cohort retention heat-map */}
        <div style={{ background: 'white', borderRadius: 10, padding: '24px', border: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: '0.875rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cohort retention · last 6 months
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: '0.6875rem', color: '#9ca3af' }}>
            Rows = month of customer's first order. Columns = months since.
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
                        {new Date(m).toLocaleDateString('en-PK', { month: 'short', year: '2-digit' })}
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.75rem', color: '#9ca3af' }}>
        Powered by analytics_* RPCs in supabase/migrations/20260519_023_analytics_views.sql.
      </div>
    </div>
  );
}
