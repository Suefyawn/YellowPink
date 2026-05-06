export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabase';
import type { Order } from '@/types';

const fmt = (n: number) => `Rs ${n.toLocaleString()}`;
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

const payLabel: Record<string, string> = { cod: 'COD', card: 'Card', bank: 'Bank' };

export default async function DashboardPage() {
  const [{ count: productCount }, { count: orderCount }, { data: orders }, { count: blogCount }] =
    await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('blog_posts').select('*', { count: 'exact', head: true }),
    ]);

  const revenue = (orders ?? []).reduce((s: number, o: Order) => s + o.total, 0);

  const stats = [
    { label: 'Products', value: productCount ?? 0, icon: '◈', color: '#6366f1' },
    { label: 'Orders', value: orderCount ?? 0, icon: '◎', color: '#ec4899' },
    { label: 'Revenue', value: fmt(revenue), icon: '₨', color: '#10b981', isRevenue: true },
    { label: 'Blog Posts', value: blogCount ?? 0, icon: '✦', color: '#f59e0b' },
  ];

  return (
    <div style={{ padding: '32px 36px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
        Dashboard
      </h1>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 32px' }}>
        Welcome back. Here&apos;s what&apos;s happening with your store.
      </p>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 40 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: 'white',
            borderRadius: 10,
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
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

      {/* Recent Orders */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Recent Orders</h2>
          <a href="/admin/orders" style={{ fontSize: '0.8125rem', color: '#ec4899', textDecoration: 'none' }}>View all →</a>
        </div>
        {!orders || orders.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No orders yet
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Order', 'Customer', 'Total', 'Payment', 'Date'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(orders as Order[]).map((o, i) => (
                <tr key={o.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <a href={`/admin/orders/${o.id}`} style={{ fontWeight: 600, fontSize: '0.875rem', color: '#ec4899', textDecoration: 'none' }}>
                      {o.order_number}
                    </a>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                    {o.first_name} {o.last_name}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                    {fmt(o.total)}
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
