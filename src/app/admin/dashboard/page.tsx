export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { OverviewChart, type OverviewDay } from '@/components/admin/OverviewChart';
import { ORDER_STATUS_COLORS } from '@/components/admin/OrderStatusBadge';
import { DotChip, paymentState, fulfilmentState } from '@/components/admin/OrderChips';
import { KpiCard } from '@/components/admin/insights/KpiCard';
import { fmtPKR, fmtInt, pctDelta } from '@/components/admin/insights/format';
import { SentryWidget } from '@/components/admin/SentryWidget';
import { QuizStatsWidget } from '@/components/admin/QuizStatsWidget';
import { brandPlusName } from '@/lib/product-display';
import { can, canAny } from '@/lib/permissions';
import { ORDER_STATUS_LABELS } from '@/types';
import type { Order, OrderStatus, Product } from '@/types';
import { fmtDatePK as fmtDate } from '@/lib/dates';

interface DashboardKpis {
  total_revenue: number;
  order_count: number;
  status_counts: Record<string, number>;
  top_products: { id: string; name: string; brand: string; qty: number }[];
}

// Every order status, in lifecycle order, so the "Orders by Status" bars
// account for the whole order book and the percentages sum to 100%. The old
// five-status subset silently dropped payment_pending / payment_failed /
// returned / refunded while still dividing by ALL orders, so the bars only
// summed to ~72%.
const statusLabels = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
    { count: unreadMessageCount },
    { count: pendingReviewCount },
    { data: codTransitRows },
  ] = await Promise.all([
    admin.from('orders').select('*').is('archived_at', null).order('created_at', { ascending: false }).limit(5),
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
    admin.from('customer_profiles').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    // Prior-period customer comparison for the trend pill (revenue/orders/
    // sessions trends are computed in the Overview chart from its own series).
    admin.from('customer_profiles').select('*', { count: 'exact', head: true }).gte('created_at', sixtyDaysAgo).lt('created_at', thirtyDaysAgo),
    // "Needs attention" counters, surface state that's drifted past the
    // expected SLA so the owner can clear it from the dashboard:
    //  • payment_pending older than 24h (gateway likely never confirmed)
    //  • plain pending older than 3 days (waiting on confirmation too long)
    //  • return requests still in `pending` state
    //  • unread customer messages and reviews awaiting moderation (same
    //    filters as the sidebar badges, so the two surfaces agree)
    admin.from('orders').select('*', { count: 'exact', head: true })
      .eq('status', 'payment_pending').is('archived_at', null).lt('created_at', oneDayAgo),
    admin.from('orders').select('*', { count: 'exact', head: true })
      .eq('status', 'pending').is('archived_at', null).lt('created_at', threeDaysAgo),
    admin.from('return_requests').select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    admin.from('contact_messages').select('*', { count: 'exact', head: true })
      .eq('status', 'new'),
    admin.from('product_reviews').select('*', { count: 'exact', head: true })
      .eq('approved', false),
    // COD cash pipeline: orders on the road, the cash the courier is
    // carrying for you right now. The single most-asked number in a
    // COD-heavy store.
    // "Cash in transit" means cash coming to the STORE: vendor-collected COD
    // (vendor delivers and keeps the cash; settles on the Vendors page) is
    // excluded via the vendors join below.
    admin.from('orders').select('total, vendor_id, vendors(settlement_direction)').eq('status', 'shipped').eq('pay_method', 'cod').is('archived_at', null),
  ]);

  // 180-day daily series for the interactive Overview chart (it shows up to a
  // 90-day window plus the prior 90-day comparison). Pulls orders/revenue from
  // analytics_daily and sessions from the SEO trend table, then zero-fills every
  // day so the line is continuous even on no-sale days.
  const [{ data: dailyRows }, { data: seoRows }] = await Promise.all([
    admin.rpc('analytics_daily' as never, { p_days: 180 } as never) as unknown as Promise<{ data: Array<{ day: string; orders: number; revenue: number }> | null }>,
    admin.rpc('seo_metrics_trend' as never, { p_days: 180 } as never) as unknown as Promise<{ data: Array<{ day: string; ga4_sessions: number | null }> | null }>,
  ]);
  // Series keys are PKT calendar days to match analytics_daily's buckets
  // (migration 340) — UTC keys would orphan today's PKT row every night
  // between 00:00 and 05:00 local.
  const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
  const seriesMap = new Map<string, OverviewDay>();
  for (let i = 179; i >= 0; i--) {
    const d = new Date(nowMs + PKT_OFFSET_MS - i * 86_400_000).toISOString().slice(0, 10);
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

  // ── Today row ── sourced from the same analytics_daily series that powers
  // the Overview chart, so the headline numbers and the chart can never
  // disagree. The delta compares today-so-far against the SAME WEEKDAY last
  // week (a full day), the fairest daily baseline for a store whose sales
  // swing by weekday — an early-morning dip is expected and the pill's label
  // says what it's comparing.
  const today = overviewSeries[overviewSeries.length - 1];
  const lastSameWeekday = overviewSeries[overviewSeries.length - 8];
  const todayWeekday = WEEKDAYS[new Date(`${today.date}T00:00:00Z`).getUTCDay()];
  const vsLabel = `vs last ${todayWeekday}`;
  const spark14 = (at: (d: OverviewDay) => number) => overviewSeries.slice(-14).map(at);
  const todayAov = today.orders > 0 ? today.revenue / today.orders : 0;
  const lastAov = lastSameWeekday.orders > 0 ? lastSameWeekday.revenue / lastSameWeekday.orders : 0;
  // GA4 sessions land a day late; show today's if present, else yesterday's.
  const sessionDayIdx = (() => {
    for (let i = overviewSeries.length - 1; i >= overviewSeries.length - 2 && i >= 0; i--) {
      if (overviewSeries[i].sessions != null) return i;
    }
    return -1;
  })();
  const sessionDay = sessionDayIdx >= 0 ? overviewSeries[sessionDayIdx] : null;
  const sessionPrev = sessionDayIdx >= 7 ? overviewSeries[sessionDayIdx - 7].sessions : null;

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
  // Thumbnails for the Top Products card — one query for the (max 5) ids.
  const topIds = kpis.top_products.map(p => p.id).filter(Boolean);
  const { data: topImgRows } = topIds.length
    ? await admin.from('products').select('id, image_url').in('id', topIds)
    : { data: [] };
  const imgById = new Map(((topImgRows ?? []) as { id: string; image_url: string | null }[]).map(r => [r.id, r.image_url]));
  const topProducts = kpis.top_products.map(p => ({ id: p.id, name: p.name, brand: p.brand, qty: p.qty, image: imgById.get(p.id) ?? null }));

  const ordersToFulfill = (statusCounts.pending ?? 0) + (statusCounts.processing ?? 0);
  type CodTransitRow = { total: number; vendors: { settlement_direction: string | null } | { settlement_direction: string | null }[] | null };
  const codTransitStore = ((codTransitRows ?? []) as CodTransitRow[]).filter(o => {
    const v = Array.isArray(o.vendors) ? o.vendors[0] : o.vendors;
    return v?.settlement_direction !== 'vendor_collects';
  });
  const codInTransit = codTransitStore.reduce((t, o) => t + Number(o.total ?? 0), 0);
  const codTransitCount = codTransitStore.length;
  // Yesterday's full-day numbers give the always-zero early morning some
  // context (the delta pill compares same-weekday-last-week; this line is
  // simply "what did we do yesterday").
  const yesterday = overviewSeries[overviewSeries.length - 2];
  const yesterdayAov = yesterday.orders > 0 ? yesterday.revenue / yesterday.orders : 0;

  const customerDelta = pctDelta(newCustomerCount ?? 0, prevCustomerCount ?? 0);

  // Everything waiting on a human, one triage list. Red = money/orders at
  // risk; amber = routine queue work. Rendered right under the Today row so
  // morning triage starts here instead of on five separate pages.
  const attention: { count: number; label: string; href: string; tone: 'red' | 'amber' }[] = [];
  if ((stuckPaymentCount ?? 0) > 0) attention.push({
    count: stuckPaymentCount ?? 0, tone: 'red',
    label: `payment-pending order${(stuckPaymentCount ?? 0) === 1 ? '' : 's'} stuck > 24h`,
    href: '/admin/orders?status=payment_pending',
  });
  if ((stalePendingCount ?? 0) > 0) attention.push({
    count: stalePendingCount ?? 0, tone: 'red',
    label: `unconfirmed order${(stalePendingCount ?? 0) === 1 ? '' : 's'} > 3 days old`,
    href: '/admin/orders?status=pending',
  });
  if ((openReturnsCount ?? 0) > 0) attention.push({
    count: openReturnsCount ?? 0, tone: 'amber',
    label: `return request${(openReturnsCount ?? 0) === 1 ? '' : 's'} awaiting approval`,
    href: '/admin/returns',
  });
  if ((unreadMessageCount ?? 0) > 0) attention.push({
    count: unreadMessageCount ?? 0, tone: 'amber',
    label: `unread customer message${(unreadMessageCount ?? 0) === 1 ? '' : 's'}`,
    href: '/admin/messages',
  });
  if ((pendingReviewCount ?? 0) > 0) attention.push({
    count: pendingReviewCount ?? 0, tone: 'amber',
    label: `review${(pendingReviewCount ?? 0) === 1 ? '' : 's'} awaiting moderation`,
    href: '/admin/reviews',
  });
  const hasRed = attention.some(a => a.tone === 'red');

  const greeting = (() => {
    // Store-local (Asia/Karachi, fixed UTC+5, no DST) hour — the server runs
    // in UTC, so getUTCHours() greeted the operator 5 hours behind.
    const h = new Date(nowMs + 5 * 60 * 60 * 1000).getUTCHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();
  const firstName = session?.name?.trim().split(/\s+/)[0];

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
        {/* One-tap starts for the most common jobs; each is permission-gated. */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {can(session, 'orders.edit') && <Link href="/admin/orders/new" className="adm-btn adm-btn-primary">+ New order</Link>}
          {can(session, 'products.edit') && <Link href="/admin/products/new" className="adm-btn adm-btn-secondary">Add product</Link>}
          {can(session, 'coupons') && <Link href="/admin/coupons" className="adm-btn adm-btn-secondary">Coupons</Link>}
          {can(session, 'blog') && <Link href="/admin/blog/new" className="adm-btn adm-btn-secondary">New post</Link>}
        </div>
      </div>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 24px' }}>
        Here&apos;s what&apos;s happening with your store today.
      </p>

      {/* ── Overview block (gated on `analytics` permission) ────────────── */}
      {canOverview && (
      <>
      {/* Today row: the numbers an owner opens the dashboard for, before any
          scrolling. Same data source as the Overview chart below. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today</h2>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{todayWeekday}, {fmtDate(`${today.date}T00:00:00Z`)}</span>
      </div>
      <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${sessionDay ? 4 : 3}, 1fr)`, gap: 16, marginBottom: 28 }}>
        <KpiCard
          label="Sales today"
          value={fmtPKR(today.revenue)}
          accent="#10b981"
          delta={pctDelta(today.revenue, lastSameWeekday.revenue) != null ? { pct: pctDelta(today.revenue, lastSameWeekday.revenue)!, goodWhenUp: true, vs: vsLabel } : null}
          spark={spark14(d => d.revenue)}
          hint={`Yesterday ${fmtPKR(yesterday.revenue)}`}
        />
        <KpiCard
          label="Orders today"
          value={fmtInt(today.orders)}
          accent="#C5286A"
          href="/admin/orders?range=1d"
          delta={pctDelta(today.orders, lastSameWeekday.orders) != null ? { pct: pctDelta(today.orders, lastSameWeekday.orders)!, goodWhenUp: true, vs: vsLabel } : null}
          spark={spark14(d => d.orders)}
          hint={`Yesterday ${fmtInt(yesterday.orders)}`}
        />
        <KpiCard
          label="Avg order value"
          value={fmtPKR(todayAov)}
          accent="#6366f1"
          delta={pctDelta(todayAov, lastAov) != null ? { pct: pctDelta(todayAov, lastAov)!, goodWhenUp: true, vs: vsLabel } : null}
          spark={spark14(d => (d.orders > 0 ? d.revenue / d.orders : 0))}
          hint={`Yesterday ${fmtPKR(yesterdayAov)}`}
        />
        {sessionDay && (
          <KpiCard
            label={sessionDay.date === today.date ? 'Visitors today' : 'Visitors yesterday'}
            value={fmtInt(sessionDay.sessions ?? 0)}
            accent="#0ea5e9"
            delta={sessionPrev != null && pctDelta(sessionDay.sessions ?? 0, sessionPrev) != null ? { pct: pctDelta(sessionDay.sessions ?? 0, sessionPrev)!, goodWhenUp: true, vs: 'vs a week before' } : null}
            spark={overviewSeries.slice(-14).map(d => d.sessions ?? 0)}
            hint="GA4 sessions"
          />
        )}
      </div>

      {/* Needs attention, only renders when there's actually something
          actionable. Each row links into the filtered list. */}
      {attention.length > 0 && (
        <div style={{
          background: 'white', border: `1px solid ${hasRed ? '#fecaca' : '#e5e7eb'}`, borderRadius: 12,
          padding: '18px 22px', marginBottom: 28, boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: hasRed ? '#991b1b' : '#111827' }}>
              Needs attention
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              {attention.length} thing{attention.length === 1 ? '' : 's'} to clear
            </span>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {attention.map(it => (
              <li key={it.href}>
                <Link href={it.href} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: '#fafafa',
                  border: '1px solid #f3f4f6', borderRadius: 8,
                  textDecoration: 'none', color: '#374151',
                  fontSize: '0.875rem',
                }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 26, height: 26, padding: '0 6px',
                    borderRadius: 13, background: it.tone === 'red' ? '#dc2626' : '#d97706', color: 'white',
                    fontSize: '0.75rem', fontWeight: 700,
                  }}>
                    {it.count}
                  </span>
                  <span style={{ flex: 1 }}>{it.label}</span>
                  <span aria-hidden="true" style={{ color: it.tone === 'red' ? '#dc2626' : '#d97706' }}>→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Interactive overview: clickable Sales / Orders / AOV / Sessions tiles
          driving one chart with a previous-period comparison line + hover. */}
      <OverviewChart series={overviewSeries} />

      {/* Compact operational quick-stats, the at-a-glance numbers that aren't
          time-series (point-in-time counts). Each links into its filtered list. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }} className="adm-stat-grid">
        <KpiCard label="Orders to fulfil" value={ordersToFulfill} href="/admin/orders?status=tofulfil" accent="#C5286A"
          hint={ordersToFulfill > 0 ? 'Needs action' : 'All clear'} />
        <KpiCard label="COD cash in transit" value={fmtPKR(codInTransit)} href="/admin/orders?status=shipped" accent="#f59e0b"
          hint={codTransitCount > 0 ? `${codTransitCount} shipped COD order${codTransitCount === 1 ? '' : 's'}` : 'Nothing on the road'} />
        <KpiCard label="New customers · 30d" value={newCustomerCount ?? 0} href="/admin/users" accent="#6366f1"
          delta={customerDelta != null ? { pct: customerDelta, goodWhenUp: true, vs: 'vs prev 30d' } : null} />
      </div>

      {/* Recent Orders — the store's pulse, with the same split payment /
          fulfilment chips as the orders list. */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: 32 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Recent Orders</h2>
          <Link href="/admin/orders" style={{ fontSize: '0.8125rem', color: '#C5286A', textDecoration: 'none' }}>View all →</Link>
        </div>
        {!recentOrders || recentOrders.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No orders yet
          </div>
        ) : (
          /* Inner scroller: on tablet widths the table's natural width exceeds
             the card, and the card's overflow:hidden would clip the last
             columns with no way to reach them. */
          <div className="adm-table-scroll" style={{ overflowX: 'auto' }}>
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Order #', 'Customer', 'Total', 'Payment', 'Fulfilment', 'Date'].map(h => (
                  <th scope="col" key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(recentOrders as Order[]).map((o, i) => {
                const pay = paymentState(o);
                const ful = fulfilmentState(o);
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
                    <td data-label="Total" style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtPKR(o.total)}
                    </td>
                    <td data-label="Payment" style={{ padding: '12px 16px' }}>
                      <DotChip label={pay.label} color={pay.color} />
                    </td>
                    <td data-label="Fulfilment" style={{ padding: '12px 16px' }}>
                      <DotChip label={ful.label} color={ful.color} />
                    </td>
                    <td data-label="Date" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
                      {o.created_at ? fmtDate(o.created_at) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts && lowStockProducts.length > 0 && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
          padding: '20px 24px', marginBottom: 32,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#92400e' }}>
              ⚠ Low Stock Alert ({lowStockCount ?? lowStockProducts.length} item{(lowStockCount ?? lowStockProducts.length) > 1 ? 's' : ''})
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
            {/* The five fulfilment statuses always render; the payment/return
                edge statuses only when they actually hold orders, so the card
                stays compact without hiding any order from the maths. */}
            {statusLabels.filter(s =>
              ['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(s) || (statusCounts[s] ?? 0) > 0
            ).map(s => {
              const count = statusCounts[s] ?? 0;
              const pct = orderCount ? Math.round((count / orderCount) * 100) : 0;
              return (
                <div key={s}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>{ORDER_STATUS_LABELS[s] ?? s}</span>
                    <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: ORDER_STATUS_COLORS[s], borderRadius: 3, transition: 'width 0.3s' }} />
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
                <Link key={p.id ?? p.name} href={p.id ? `/admin/products/${p.id}` : '/admin/products'} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%', background: '#fdf2f8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.6875rem', fontWeight: 700, color: '#C5286A', flexShrink: 0,
                  }}>{i + 1}</span>
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" width={36} height={36} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 8, border: '1px solid #f3f4f6', flexShrink: 0 }} />
                  ) : (
                    <span style={{ width: 36, height: 36, borderRadius: 8, background: '#f9fafb', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{brandPlusName(p.brand, p.name)}</div>
                  </div>
                  <span style={{ fontSize: '0.8125rem', color: '#6b7280', fontWeight: 600, flexShrink: 0 }}>{p.qty} sold</span>
                </Link>
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

      {/* ── Error monitoring (gated on `analytics_errors`) ─────────────── */}
      {canErrors && (
        <div style={{ marginBottom: 32 }}>
          <SentryWidget />
        </div>
      )}

      {/* ── Product-finder quiz funnel, demoted to a collapsed zone: useful
          weekly reading, not part of the daily triage loop. Native <details>
          so it costs no client JS. ─────────────────────────────────────── */}
      {canOverview && (
        <details style={{ marginBottom: 32 }}>
          <summary style={{
            cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: '#6b7280',
            padding: '12px 16px', background: 'white', borderRadius: 10,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)', listStyle: 'none',
          }}>
            More insights: product-finder quiz funnel ▾
          </summary>
          <div style={{ marginTop: 12 }}>
            <QuizStatsWidget />
          </div>
        </details>
      )}
    </div>
  );
}
