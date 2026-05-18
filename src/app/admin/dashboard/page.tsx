export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { SentryWidget } from '@/components/admin/SentryWidget';
import { PostHogWidget } from '@/components/admin/PostHogWidget';
import { RefreshAnalyticsButton } from '@/components/admin/RefreshAnalyticsButton';
import type { Order, Product, CartItem } from '@/types';

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
  if (session && !session.isOwner && !session.permissions.includes('analytics')) {
    return <NoAccess section="Dashboard" />;
  }
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: productCount },
    { count: orderCount },
    { data: recentOrders },
    { count: blogCount },
    { data: allOrders },
    { data: lowStockProducts },
    { data: recentOrdersForChart },
  ] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('blog_posts').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('total, status, items'),
    supabase.from('products').select('*').lte('stock', 5).order('stock', { ascending: true }),
    supabase.from('orders').select('total, status, created_at').gte('created_at', thirtyDaysAgo).neq('status', 'cancelled'),
  ]);

  // Build 30-day revenue series
  const dayMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dayMap[d.toISOString().slice(0, 10)] = 0;
  }
  for (const o of (recentOrdersForChart ?? []) as Array<{ total: number; created_at: string }>) {
    const day = o.created_at.slice(0, 10);
    if (day in dayMap) dayMap[day] += o.total;
  }
  const chartDays = Object.entries(dayMap).map(([date, revenue]) => ({ date, revenue }));

  const allOrdersList = (allOrders ?? []) as Array<{ total: number; status: string; items: CartItem[] }>;
  // Revenue excludes cancelled orders
  const revenue = allOrdersList.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);

  // Status breakdown
  const statusCounts = statusLabels.reduce<Record<string, number>>((acc, s) => {
    acc[s] = allOrdersList.filter(o => o.status === s).length;
    return acc;
  }, {});

  // Top products by order quantity
  const productQty: Record<string, { name: string; brand: string; qty: number }> = {};
  for (const order of allOrdersList) {
    for (const item of (order.items ?? [])) {
      if (!productQty[item.id]) productQty[item.id] = { name: item.name, brand: item.brand, qty: 0 };
      productQty[item.id].qty += item.qty;
    }
  }
  const topProducts = Object.values(productQty).sort((a, b) => b.qty - a.qty).slice(0, 5);

  const stats = [
    { label: 'Products', value: productCount ?? 0, icon: '◈', color: '#6366f1' },
    { label: 'Orders', value: orderCount ?? 0, icon: '◎', color: '#ec4899' },
    { label: 'Revenue (excl. cancelled)', value: fmt(revenue), icon: '₨', color: '#10b981', isRevenue: true },
    { label: 'Blog Posts', value: blogCount ?? 0, icon: '✦', color: '#f59e0b' },
  ];

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>
          Dashboard
        </h1>
        <RefreshAnalyticsButton />
      </div>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 32px' }}>
        Welcome back. Here&apos;s what&apos;s happening with your store.
      </p>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }} className="adm-stat-grid">
        {stats.map(s => (
          <div key={s.label} style={{
            background: 'white', borderRadius: 10, padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280', fontSize: '0.8125rem', fontWeight: 500 }}>{s.label}</span>
              <span style={{
                width: 36, height: 36, borderRadius: 8,
                background: s.color + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', color: s.color,
              }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: s.isRevenue ? '1.375rem' : '1.875rem', fontWeight: 700, color: '#111827' }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '24px', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Revenue — Last 30 Days</h2>
          <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
            {fmt(chartDays.reduce((s, d) => s + d.revenue, 0))} total
          </span>
        </div>
        <RevenueChart days={chartDays} />
      </div>

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
                  {p.brand} {p.name}
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
                    <span style={{ fontSize: '0.8125rem', color: '#374151', textTransform: 'capitalize', fontWeight: 500 }}>{s}</span>
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
                    fontSize: '0.75rem', fontWeight: 700, color: '#ec4899', flexShrink: 0,
                  }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.brand} {p.name}</div>
                  </div>
                  <span style={{ fontSize: '0.8125rem', color: '#6b7280', fontWeight: 600, flexShrink: 0 }}>{p.qty} sold</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sentry + PostHog widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }} className="adm-analytics-grid">
        <SentryWidget />
        <PostHogWidget />
      </div>

      {/* Recent Orders */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Recent Orders</h2>
          <Link href="/admin/orders" style={{ fontSize: '0.8125rem', color: '#ec4899', textDecoration: 'none' }}>View all →</Link>
        </div>
        {!recentOrders || recentOrders.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No orders yet
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Order', 'Customer', 'Total', 'Status', 'Payment', 'Date'].map(h => (
                  <th scope="col" key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(recentOrders as Order[]).map((o, i) => {
                const status = o.status ?? 'pending';
                return (
                  <tr key={o.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/admin/orders/${o.id}`} style={{ fontWeight: 600, fontSize: '0.875rem', color: '#ec4899', textDecoration: 'none' }}>
                        {o.order_number}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                      {o.first_name} {o.last_name}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                      {fmt(o.total)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                        fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize',
                        background: (statusColors[status] ?? '#6b7280') + '20',
                        color: statusColors[status] ?? '#6b7280',
                      }}>
                        {status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px',
                        background: '#f3f4f6', borderRadius: 20,
                        fontSize: '0.75rem', fontWeight: 500, color: '#374151',
                      }}>
                        {payLabel[o.pay_method] ?? o.pay_method}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
                      {o.created_at ? fmtDate(o.created_at) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
