export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { OrdersFilter } from '@/components/admin/OrdersFilter';
import { OrdersBulkBar } from '@/components/admin/OrdersBulkBar';
import type { Order, OrderStatus } from '@/types';

const fmt = (n: number) => `Rs ${n.toLocaleString()}`;
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

const payBadge: Record<string, { bg: string; color: string; label: string }> = {
  cod:  { bg: '#fef3c7', color: '#92400e', label: 'COD' },
  card: { bg: '#ede9fe', color: '#5b21b6', label: 'Card' },
  bank: { bg: '#dbeafe', color: '#1e40af', label: 'Bank' },
};

const statusColors: Record<string, string> = {
  pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6',
  delivered: '#10b981', cancelled: '#ef4444',
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;

  let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (status && status !== 'all') query = query.eq('status', status as OrderStatus);
  if (q) query = query.or(`order_number.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`);

  const { data: orders } = await query;
  const list = (orders ?? []) as Order[];

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Orders</h1>
      </div>

      <Suspense fallback={null}>
        <OrdersFilter total={list.length} />
      </Suspense>

      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {list.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No orders found
          </div>
        ) : (
          <OrdersBulkBar orderIds={list.map(o => o.id!)}>
            {(toggle, selected) => (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '11px 12px', width: 40 }} />
                    {['Order #', 'Customer', 'Total', 'Status', 'Payment', 'Date', ''].map(h => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((o, i) => {
                    const badge = payBadge[o.pay_method] ?? { bg: '#f3f4f6', color: '#374151', label: o.pay_method };
                    const st = o.status ?? 'pending';
                    const isSelected = selected.has(o.id!);
                    return (
                      <tr key={o.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', background: isSelected ? '#fdf2f8' : 'transparent' }}>
                        <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggle(o.id!)}
                            style={{ cursor: 'pointer', accentColor: '#ec4899' }}
                          />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Link href={`/admin/orders/${o.id}`} style={{ fontWeight: 700, fontSize: '0.875rem', color: '#ec4899', textDecoration: 'none', fontFamily: 'monospace' }}>
                            {o.order_number}
                          </Link>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                          {o.first_name} {o.last_name}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.875rem', color: '#111827', whiteSpace: 'nowrap' }}>
                          {fmt(o.total)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                            fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize',
                            background: (statusColors[st] ?? '#6b7280') + '20',
                            color: statusColors[st] ?? '#6b7280',
                          }}>
                            {st}
                          </span>
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
                            View →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </OrdersBulkBar>
        )}
      </div>
    </div>
  );
}
