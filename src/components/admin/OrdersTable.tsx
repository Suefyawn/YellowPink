'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { bulkUpdateOrderStatus } from '@/app/admin/actions';
import { useToast } from '@/components/admin/Toast';
import type { Order, OrderStatus } from '@/types';

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

const BULK_STATUSES: { value: OrderStatus; label: string; color: string }[] = [
  { value: 'processing', label: 'Processing', color: '#3b82f6' },
  { value: 'shipped',    label: 'Shipped',    color: '#8b5cf6' },
  { value: 'delivered',  label: 'Delivered',  color: '#10b981' },
  { value: 'cancelled',  label: 'Cancelled',  color: '#ef4444' },
];

export function OrdersTable({ orders }: { orders: Order[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    return next;
  });

  const toggleAll = () => setSelected(
    selected.size === orders.length ? new Set() : new Set(orders.map(o => o.id!))
  );

  const bulk = (status: OrderStatus) => {
    if (selected.size === 0) return;
    const count = selected.size;
    startTransition(async () => {
      const result = await bulkUpdateOrderStatus(Array.from(selected), status);
      if (result.error) {
        toast(`Couldn't update orders: ${result.error}`, 'error');
        return;
      }
      setSelected(new Set());
      toast(`${count} order${count !== 1 ? 's' : ''} marked as ${status}`, 'success');
    });
  };

  if (orders.length === 0) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
        No orders found
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <th scope="col" style={{ padding: '11px 12px', width: 40, textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={selected.size === orders.length && orders.length > 0}
                onChange={toggleAll}
                title="Select all"
                style={{ cursor: 'pointer', accentColor: '#C5286A' }}
              />
            </th>
            {['Order #', 'Customer', 'Total', 'Status', 'Payment', 'Date'].map(h => (
              <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => {
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
                    aria-label={`Select order ${o.order_number}`}
                    style={{ cursor: 'pointer', accentColor: '#C5286A' }}
                  />
                </td>
                <td data-label="Order #" style={{ padding: '12px 16px' }}>
                  <Link href={`/admin/orders/${o.id}`} style={{ fontWeight: 700, fontSize: '0.875rem', color: '#C5286A', textDecoration: 'none', fontFamily: 'monospace' }}>
                    {o.order_number}
                  </Link>
                </td>
                <td data-label="Customer" style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                  {o.first_name} {o.last_name}
                </td>
                <td data-label="Total" style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.875rem', color: '#111827', whiteSpace: 'nowrap' }}>
                  {fmt(o.total)}
                </td>
                <td data-label="Status" style={{ padding: '12px 16px' }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                    fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize',
                    background: (statusColors[st] ?? '#6b7280') + '20',
                    color: statusColors[st] ?? '#6b7280',
                  }}>
                    {st}
                  </span>
                </td>
                <td data-label="Payment" style={{ padding: '12px 16px' }}>
                  <span style={{ display: 'inline-block', padding: '3px 10px', background: badge.bg, color: badge.color, borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>
                    {badge.label}
                  </span>
                </td>
                <td data-label="Date" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                  {o.created_at ? fmtDate(o.created_at) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selected.size > 0 && (
        <div className="adm-bulk-bar" style={{
          position: 'sticky', bottom: 16, zIndex: 20,
          background: '#111827', borderRadius: 10,
          padding: '12px 20px', margin: '12px 0 0',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          <span style={{ color: '#f9fafb', fontSize: '0.875rem', fontWeight: 600 }}>
            {selected.size} selected
          </span>
          <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}>Mark as:</span>
          {BULK_STATUSES.map(s => (
            <button key={s.value} onClick={() => bulk(s.value)} disabled={pending} style={{
              padding: '5px 14px', borderRadius: 20, border: 'none', cursor: pending ? 'not-allowed' : 'pointer',
              background: s.color + '30', color: s.color,
              fontSize: '0.8125rem', fontWeight: 600, opacity: pending ? 0.6 : 1,
            }}>
              {pending ? '…' : s.label}
            </button>
          ))}
          <button onClick={() => setSelected(new Set())} style={{
            marginLeft: 'auto', padding: '5px 12px', borderRadius: 6,
            border: '1px solid #374151', background: 'transparent', color: '#9ca3af',
            fontSize: '0.8125rem', cursor: 'pointer',
          }}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
