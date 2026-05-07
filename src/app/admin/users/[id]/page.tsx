export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Order, AdminUser, OrderStatus } from '@/types';

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const statusColors: Record<string, string> = {
  pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6', delivered: '#10b981', cancelled: '#ef4444',
};

const payLabel: Record<string, string> = { cod: 'COD', card: 'Card', bank: 'Bank' };

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [{ data: userData }, { data: orders }] = await Promise.all([
    supabase.rpc('get_admin_user' as never, { p_id: id } as never),
    supabase.from('orders').select('*').eq('user_id', id).order('created_at', { ascending: false }),
  ]);

  if (!userData) notFound();

  const user = userData as AdminUser;
  const orderList = (orders ?? []) as Order[];
  const totalSpend = orderList.reduce((s, o) => s + o.total, 0);
  const deliveredCount = orderList.filter(o => o.status === 'delivered').length;

  const section: React.CSSProperties = {
    background: 'white', borderRadius: 10,
    padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  };

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Link href="/admin/users" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>← Customers</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
          {user.first_name || user.last_name
            ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
            : user.email}
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, marginBottom: 20 }}>
        {/* Profile card */}
        <div>
          <div style={{ ...section, marginBottom: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', marginBottom: 16,
            }}>
              {(user.first_name?.[0] ?? user.email[0]).toUpperCase()}
            </div>
            <h2 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
              {user.first_name || user.last_name
                ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
                : '—'}
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.875rem', color: '#6b7280' }}>{user.email}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                <span style={{ color: '#6b7280' }}>Phone</span>
                <span style={{ color: '#374151', fontWeight: 500 }}>{user.phone ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                <span style={{ color: '#6b7280' }}>Joined</span>
                <span style={{ color: '#374151' }}>{fmtDate(user.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Orders', value: orderList.length, wide: false },
              { label: 'Delivered', value: deliveredCount, wide: false },
              { label: 'Total Spend', value: fmt(totalSpend), wide: true },
            ].map(s => (
              <div key={s.label} style={{
                ...section,
                padding: '16px 20px',
                gridColumn: s.wide ? '1 / -1' : undefined,
              }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Order history */}
        <div style={section}>
          <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
            Order History
          </h2>
          {orderList.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
              No orders yet
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                  {['Order #', 'Date', 'Items', 'Total', 'Status', 'Payment', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderList.map((o, i) => {
                  const status = (o.status ?? 'pending') as OrderStatus;
                  const itemCount = (o.items ?? []).length;
                  return (
                    <tr key={o.id} style={{ borderTop: i > 0 ? '1px solid #f9fafb' : 'none' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <Link href={`/admin/orders/${o.id}`} style={{ fontWeight: 700, fontSize: '0.875rem', color: '#ec4899', textDecoration: 'none', fontFamily: 'monospace' }}>
                          {o.order_number}
                        </Link>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {o.created_at ? fmtDateTime(o.created_at) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '0.8125rem', color: '#374151' }}>
                        {itemCount} item{itemCount !== 1 ? 's' : ''}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '0.875rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                        {fmt(o.total)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                          fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize',
                          background: (statusColors[status] ?? '#6b7280') + '20',
                          color: statusColors[status] ?? '#6b7280',
                        }}>
                          {status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px',
                          background: '#f3f4f6', borderRadius: 20,
                          fontSize: '0.75rem', color: '#374151',
                        }}>
                          {payLabel[o.pay_method] ?? o.pay_method}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <Link href={`/admin/orders/${o.id}`} style={{
                          padding: '4px 10px', background: '#f3f4f6', color: '#374151',
                          borderRadius: 6, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 500,
                        }}>
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
