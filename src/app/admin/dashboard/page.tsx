export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { OverviewChart, type OverviewDay } from '@/components/admin/OverviewChart';
import { SentryWidget } from '@/components/admin/SentryWidget';
import { QuizStatsWidget } from '@/components/admin/QuizStatsWidget';
import { brandPlusName } from '@/lib/product-display';
import { can, canAny } from '@/lib/permissions';
import { ORDER_STATUS_LABELS } from '@/types';
import type { Order, OrderStatus, Product } from '@/types';

interface DashboardKpis {
  total_revenue: number;
  order_count: number;
  status_counts: Record<string, number>;
  top_products: { id: string; name: string; brand: string; qty: number }[];
}

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

const payLabel: Record<string, string> = { cod: 'COD', card: 'Card', bank: 'Bank' };

const statusColors: Record<string, string> = {
  pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6', delivered: '#10b981', cancelled: '#ef4444',
};

const statusLabels = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

export default async function DashboardPage() {
  const session = await getStaffSession();
  // Dashboard is the landing surface, anyone with overview OR either of the
  // finer analytics perms can land here; they'll just see fewer widgets.
  if (!session || !canAny(session, ['analytics', 'analytics_traffic', 'analytics_errors'])) {
    return <NoAccess section="Dashboard" />;
  }
  const canOverview = !session || can(session, 'analytics');
  const canErrors   = !session || can(session, 'analytics_errors');
  // Server components render once per request, pulling the "now" once
  // here is fine. The `react-hooks/purity` rule flags Date.now() as impure;
  // that warning is for client components that may be re-rendered by the
  // React Compiler. Async server components don't memoise.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const thirtyDaysAgo = new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString();
  // Prior 30-day window [60d ago, 30d ago), powers the period-over-period
  // trend pills on the KPI cards.
  const sixtyDaysAgo = new Date(nowMs - 60 * 24 * 60 * 60 * 1000).toISOString();
  // "Stuck" thresholds, orders/returns sitting longer than this are surfaced
  // in the Needs-attention card so they don't drift past the operator's eye.
  const oneDayAgo = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(nowMs - 3 * 24 * 60 * 60 * 1000).toISOString();

  // orders RLS (migration 070) drops anon SELECT, use the service role
  // for every orders read on this page. products / blog_posts still
  // allow anon SELECT and can stay on the public client.
  const admin = supabaseAdmin();
  const [
    { data: recentOrders },
    { data: kpisData },
    { data: lowStockProducts },
    { count: lowStockCount },
    { count: newCustomerCount },
    { count: prevCustomerCount },
    { count: stuckPaymentCount },
    { count: stalePendingCount },
    { count: openReturnsCount },
  ] = await Promise.all([
    admin.from('orders').select('*').order('created_at', { ascending: false }).limit(5),
    // P1 audit fix: aggregated KPIs (revenue, order count, status histogram,
    // top products) in one SQL pass via dashboard_kpis() RPC. Previously
    // pulled every orders row + its JSONB items into Node and aggregated in
    // JS, would degrade linearly with order count.
    admin.rpc('dashboard_kpis' as never) as unknown as Promise<{ data: DashboardKpis | null }>,
    // Cap the low-stock list to 50 so a long-tail catalog with many
    // out-of-stock rows doesn't blow up the dashboard; the card next to it
    // shows the exact count.
    supabase.from('products').select('*').eq('track_inventory', true).lte('stock', 5).order('stock', { ascending: true }).limit(50),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('track_inventory', true).lte('stock', 5),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    // Prior-period customer comparison for the trend pill (revenue/orders/
    // sessions trends are computed in the Overview chart from its own series).
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sixtyDaysAgo).lt('created_at', thirtyDaysAgo),
    // "Needs attention" counters, surface state that's drifted past the
    // expected SLA so the owner can clear it from the dashboard:
    //  • payment_pending older than 24h (gateway likely never confirmed)
    //  • plain pending older than 3 days (waiting on confirmation too long)
    //  • return requests still in `pending` state
    admin.from('orders').select('*', { count: 'exact', head: true })
      .eq('status', 'payment_pending').lt('created_at', oneDayAgo),
    admin.from('orders').select('*', { count: 'exact', head: true })
      .eq('status', 'pending').lt('created_at', threeDaysAgo),
    admin.from('return_requests').select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ]);

  // 180-day daily series for the interactive Overview chart (it shows up to a
  // 90-day window plus the prior 90-day comparison). Pulls orders/revenue from
  // analytics_daily and sessions from the SEO trend table, then zero-fills every
  // day so the line is continuous even on no-sale days.
  const [{ data: dailyRows }, { data: seoRows }] = await Promise.all([
    admin.rpc('analytics_daily' as never, { p_days: 180 } as never) as unknown as Promise<{ data: Array<{ day: string; orders: number; revenue: number }> | null }>,
    admin.rpc('seo_metrics_trend' as never, { p_days: 180 } as never) as unknown as Promise<{ data: Array<{ day: string; ga4_sessions: number | null }> | null }>,
  ]);
  const seriesMap = new Map<string, OverviewDay>();
  for (let i = 179; i >= 0; i--) {
    const d = new Date(nowMs - i * 86_400_000).toISOString().slice(0, 10);
    seriesMap.set(d, { date: d, revenue: 0, orders: 0, sessions: null });
  }
  for (const r of (dailyRows ?? [])) {
    const e = seriesMap.get(String(r.day).slice(0, 10));
    if (e) { e.revenue = Number(r.revenue) || 0; e.orders = Number(r.orders) || 0; }
  }
  for (const r of (seoRows ?? [])) {
    const e = seriesMap.get(String(r.day).slice(0, 10));
    if (e && r.ga4_sessions != null) e.sessions = Number(r.ga4_sessions);
  }
  const overviewSeries: OverviewDay[] = [...seriesMap.values()];

  // Unpack the aggregated KPIs. RPC returns one jsonb object; default to
  // empty shape if it ever returns null (RLS denied, table missing, etc.).
  const kpis: DashboardKpis = kpisData ?? {
    total_revenue: 0, order_count: 0, status_counts: {}, top_products: [],
  };
  const orderCount = kpis.order_count;
  const statusCounts = statusLabels.reduce<Record<string, number>>((acc, s) => {
    acc[s] = kpis.status_counts[s] ?? 0;
    return acc;
  }, {});
  const topProducts = kpis.top_products.map(p => ({ name: p.name, brand: p.brand, qty: p.qty }));

  const ordersToFulfill = (statusCounts.pending ?? 0) + (statusCounts.processing ?? 0);

  // Period-over-period customer delta for the quick-stat hint.
  const pctChange = (cur: number, prev: number): number | null => {
    if (prev <= 0) return cur > 0 ? 100 : null;
    return Math.round(((cur - prev) / prev) * 100);
  };
  type Trend = { pct: number; goodWhenUp: boolean } | null;
  const customerTrend: Trend = (() => {
    const p = pctChange(newCustomerCount ?? 0, prevCustomerCount ?? 0);
    return p === null ? null : { pct: p, goodWhenUp: true };
  })();


  const greeting = (() => {
    const h = new Date(nowMs).getUTCHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();
  const firstName = session?.name?.trim().split(/\s+/)[0];

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
      </div>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 32px' }}>
        Here&apos;s what&apos;s happening with your store today.
      </p>

      {/* ── Overview block (gated on `analytics` permission) ────────────── */}
      {canOverview && (
      <>
      {/* Interactive overview: clickable Sales / Orders / AOV / Sessions tiles
          driving one chart with a previous-period comparison line + hover. */}
      <OverviewChart series={overviewSeries} />

      {/* Compact operational quick-stats, the at-a-glance numbers that aren't
          time-series (point-in-time counts). Each links into its filtered list. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }} className="adm-stat-grid">
        {([
          { label: 'Orders to fulfill', value: ordersToFulfill,        href: '/admin/orders',    color: '#C5286A', hint: ordersToFulfill > 0 ? 'Needs action' : 'All clear' },
          { label: 'Low stock items',   value: lowStockCount ?? 0,     href: '/admin/inventory', color: '#f59e0b', hint: (lowStockCount ?? 0) > 0 ? 'Restock soon' : 'Healthy' },
          { label: 'New customers · 30d', value: newCustomerCount ?? 0, href: '/admin/users',     color: '#6366f1', hint: customerTrend ? `${customerTrend.pct >= 0 ? '▲' : '▼'} ${Math.abs(customerTrend.pct)}% vs prev 30d` : undefined },
        ] as const).map(s => (
          <Link key={s.label} href={s.href} className="adm-kpi-card" style={{
            position: 'relative', overflow: 'hidden', background: 'white', borderRadius: 12,
            padding: '16px 18px', border: '1px solid #eef0f2', boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
            display: 'flex', flexDirection: 'column', gap: 6, textDecoration: 'none', color: 'inherit',
          }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: s.color }} />
            <span style={{ color: '#6b7280', fontSize: '0.8125rem', fontWeight: 500 }}>{s.label}</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{s.value}</span>
            {s.hint && <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{s.hint}</span>}
          </Link>
        ))}
      </div>

      {/* Needs attention, only renders when there's actually something
          actionable. Each row links into the filtered list. */}
      {(() => {
        const items: { count: number; label: string; href: string }[] = [];
        if ((stuckPaymentCount ?? 0) > 0) items.push({
          count: stuckPaymentCount ?? 0,
          label: `payment-pending order${(stuckPaymentCount ?? 0) === 1 ? '' : 's'} stuck > 24h`,
          href: '/admin/orders?status=payment_pending',
        });
        if ((stalePendingCount ?? 0) > 0) items.push({
          count: stalePendingCount ?? 0,
          label: `unconfirmed order${(stalePendingCount ?? 0) === 1 ? '' : 's'} > 3 days old`,
          href: '/admin/orders?status=pending',
        });
        if ((openReturnsCount ?? 0) > 0) items.push({
          count: openReturnsCount ?? 0,
          label: `return request${(openReturnsCount ?? 0) === 1 ? '' : 's'} awaiting approval`,
          href: '/admin/returns',
        });
        if (items.length === 0) return null;
        return (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
            padding: '18px 22px', marginBottom: 32,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#991b1b' }}>
                Needs attention
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#b91c1c' }}>
                {items.length} thing{items.length === 1 ? '' : 's'} to clear
              </span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map(it => (
                <li key={it.href}>
                  <Link href={it.href} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', background: 'white',
                    border: '1px solid #fecaca', borderRadius: 8,
                    textDecoration: 'none', color: '#7f1d1d',
                    fontSize: '0.875rem',
                  }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: 26, height: 26, padding: '0 6px',
                      borderRadius: 13, background: '#dc2626', color: 'white',
                      fontSize: '0.75rem', fontWeight: 700,
                    }}>
                      {it.count}
                    </span>
                    <span style={{ flex: 1 }}>{it.label}</span>
                    <span aria-hidden="true" style={{ color: '#dc2626' }}>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {/* Low Stock Alert */}
      {lowStockProducts && lowStockProducts.length > 0 && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
          padding: '20px 24px', marginBottom: 32,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#92400e' }}>
              ⚠ Low Stock Alert ({lowStockProducts.length} item{lowStockProducts.length > 1 ? 's' : ''})
            </h2>
            <Link href="/admin/products" style={{ fontSize: '0.8125rem', color: '#d97706', textDecoration: 'none' }}>
              Manage products →
            </Link>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {(lowStockProducts as Product[]).map(p => (
              <Link key={p.id} href={`/admin/products/${p.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px', background: 'white', borderRadius: 8,
                border: '1px solid #fde68a', textDecoration: 'none',
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, borderRadius: '50%', fontSize: '0.6875rem', fontWeight: 700,
                  background: p.stock === 0 ? '#fef2f2' : '#fffbeb',
                  color: p.stock === 0 ? '#dc2626' : '#d97706',
                }}>
                  {p.stock}
                </span>
                <span style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                  {brandPlusName(p.brand, p.name)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Orders by status + Top products */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }} className="adm-analytics-grid">
        {/* Status breakdown */}
        <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '24px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Orders by Status</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {statusLabels.map(s => {
              const count = statusCounts[s] ?? 0;
              const pct = orderCount ? Math.round((count / orderCount) * 100) : 0;
              return (
                <div key={s}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>{ORDER_STATUS_LABELS[s] ?? s}</span>
                    <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: statusColors[s], borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top products */}
        <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '24px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Top Products</h2>
          {topProducts.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No sales yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topProducts.map((p, i) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%', background: '#fdf2f8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 700, color: '#C5286A', flexShrink: 0,
                  }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{brandPlusName(p.brand, p.name)}</div>
                  </div>
                  <span style={{ fontSize: '0.8125rem', color: '#6b7280', fontWeight: 600, flexShrink: 0 }}>{p.qty} sold</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      </>
      )}
      {/* ── /Overview block ────────────────────────────────────────────── */}

      {/* Traffic widgets (funnel / PostHog / top pages / top events) now
          live on the Analytics page, the dashboard stays focused on
          today's actionable numbers. */}

      {/* ── Product-finder quiz funnel (overview-gated) ────────────────── */}
      {canOverview && (
        <div style={{ marginBottom: 32 }}>
          <QuizStatsWidget />
        </div>
      )}

      {/* ── Error monitoring (gated on `analytics_errors`) ─────────────── */}
      {canErrors && (
        <div style={{ marginBottom: 32 }}>
          <SentryWidget />
        </div>
      )}

      {/* Recent Orders (overview-gated) */}
      {canOverview && (
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Recent Orders</h2>
          <Link href="/admin/orders" style={{ fontSize: '0.8125rem', color: '#C5286A', textDecoration: 'none' }}>View all →</Link>
        </div>
        {!recentOrders || recentOrders.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No orders yet
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Order #', 'Customer', 'Total', 'Status', 'Payment', 'Date'].map(h => (
                  <th scope="col" key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(recentOrders as Order[]).map((o, i) => {
                const status = o.status ?? 'pending';
                return (
                  <tr key={o.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <td data-label="Order #" style={{ padding: '12px 16px' }}>
                      <Link href={`/admin/orders/${o.id}`} style={{ fontWeight: 600, fontSize: '0.875rem', color: '#C5286A', textDecoration: 'none' }}>
                        {o.order_number}
                      </Link>
                    </td>
                    <td data-label="Customer" style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                      {o.first_name} {o.last_name}
                    </td>
                    <td data-label="Total" style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                      {fmt(o.total)}
                    </td>
                    <td data-label="Status" style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                        fontSize: '0.75rem', fontWeight: 600,
                        background: (statusColors[status] ?? '#6b7280') + '20',
                        color: statusColors[status] ?? '#6b7280',
                      }}>
                        {ORDER_STATUS_LABELS[status as OrderStatus] ?? status}
                      </span>
                    </td>
                    <td data-label="Payment" style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px',
                        background: '#f3f4f6', borderRadius: 20,
                        fontSize: '0.75rem', fontWeight: 500, color: '#374151',
                      }}>
                        {payLabel[o.pay_method] ?? o.pay_method}
                      </span>
                    </td>
                    <td data-label="Date" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
                      {o.created_at ? fmtDate(o.created_at) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      )}
    </div>
  );
}
