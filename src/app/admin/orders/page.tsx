export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Order } from '@/types';

const fmt = (n: number) => `Rs ${n.toLocaleString()}`;
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

const payBadge: Record<string, { bg: string; color: string; label: string }> = {
  cod:  { bg: '#fef3c7', color: '#92400e', label: 'COD' },
  card: { bg: '#ede9fe', color: '#5b21b6', label: 'Card' },
  bank: { bg: '#dbeafe', color: '#1e40af', label: 'Bank' },
};

export default async function OrdersPage() {
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Orders</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>{orders?.length ?? 0} total orders</p>
      </div>

      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {!orders || orders.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No orders received yet
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Order #', 'Customer', 'Phone', 'City', 'Total', 'Payment', 'Date', ''].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(orders as Order[]).map((o, i) => {
                const badge = payBadge[o.pay_method] ?? { bg: '#f3f4f6', color: '#374151', label: o.pay_method };
                return (
                  <tr key={o.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827', fontFamily: 'monospace' }}>
                        {o.order_number}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                      {o.first_name} {o.last_name}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280' }}>{o.phone}</td>
                    <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280' }}>{o.city}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.875rem', color: '#111827', whiteSpace: 'nowrap' }}>
                      {fmt(o.total)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', background: badge.bg, color: badge.color, borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {o.created_at ? fmtDate(o.created_at) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/admin/orders/${o.id}`} style={{
                        padding: '5px 12px', background: '#f3f4f6', color: '#374151',
                        borderRadius: 6, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 500, whiteSpace: 'nowrap',
                      }}>
                        View
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
  );
}
