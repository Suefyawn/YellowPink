export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { OrdersFilter } from '@/components/admin/OrdersFilter';
import { OrdersBulkBar } from '@/components/admin/OrdersBulkBar';
import { Pagination } from '@/components/admin/Pagination';
import { ExportCSVButton } from '@/components/admin/ExportCSVButton';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import type { Order, OrderStatus } from '@/types';

const PAGE_SIZE = 25;

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;
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
  // permission check happens before searchParams destructure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...rawProps}: any) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('orders')) {
    return <NoAccess section="Orders" />;
  }
  const { searchParams } = rawProps;
  return <OrdersPageInner searchParams={searchParams} />;
}

async function OrdersPageInner({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { status, q, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let countQuery = supabase.from('orders').select('*', { count: 'exact', head: true });
  let dataQuery = supabase.from('orders').select('*').order('created_at', { ascending: false }).range(from, to);

  if (status && status !== 'all') {
    countQuery = countQuery.eq('status', status as OrderStatus);
    dataQuery = dataQuery.eq('status', status as OrderStatus);
  }
  if (q) {
    const filter = `order_number.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`;
    countQuery = countQuery.or(filter);
    dataQuery = dataQuery.or(filter);
  }

  const [{ count: totalCount }, { data: orders }] = await Promise.all([countQuery, dataQuery]);
  const total = totalCount ?? 0;
  const list = (orders ?? []) as Order[];

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Orders</h1>
        <ExportCSVButton status={status} q={q} />
      </div>

      <Suspense fallback={null}>
        <OrdersFilter total={total} />
      </Suspense>

      <div className="adm-table-scroll" style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {list.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No orders found
          </div>
        ) : (
          <OrdersBulkBar orderIds={list.map(o => o.id!)}>
            {(toggle, selected, toggleAll) => (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '11px 12px', width: 40, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selected.size === list.length && list.length > 0}
                        onChange={toggleAll}
                        title="Select all"
                        style={{ cursor: 'pointer', accentColor: '#ec4899' }}
                      />
                    </th>
                    {['Order #', 'Customer', 'Total', 'Status', 'Payment', 'Date'].map(h => (
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </OrdersBulkBar>
        )}
      </div>

      <Suspense fallback={null}>
        <Pagination total={total} pageSize={PAGE_SIZE} currentPage={page} basePath="/admin/orders" />
      </Suspense>
    </div>
  );
}
