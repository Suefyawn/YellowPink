'use client';

import { useState, useTransition } from 'react';
import { bulkUpdateOrderStatus } from '@/app/admin/actions';
import type { OrderStatus } from '@/types';

const BULK_STATUSES: { value: OrderStatus; label: string; color: string }[] = [
  { value: 'processing', label: 'Processing', color: '#3b82f6' },
  { value: 'shipped',    label: 'Shipped',    color: '#8b5cf6' },
  { value: 'delivered',  label: 'Delivered',  color: '#10b981' },
  { value: 'cancelled',  label: 'Cancelled',  color: '#ef4444' },
];

interface Props {
  orderIds: string[];
  children: (toggle: (id: string) => void, selected: Set<string>) => React.ReactNode;
}

export function OrdersBulkBar({ orderIds, children }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    return next;
  });

  const toggleAll = () => setSelected(
    selected.size === orderIds.length ? new Set() : new Set(orderIds)
  );

  const bulk = (status: OrderStatus) => {
    if (selected.size === 0) return;
    startTransition(async () => {
      await bulkUpdateOrderStatus(Array.from(selected), status);
      setSelected(new Set());
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Select-all checkbox row injected above table via children */}
      {children(toggle, selected)}

      {selected.size > 0 && (
        <div style={{
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
              {s.label}
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

      {/* Select-all button */}
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={toggleAll} style={{
          fontSize: '0.75rem', color: '#6b7280', background: 'none', border: 'none',
          cursor: 'pointer', textDecoration: 'underline',
        }}>
          {selected.size === orderIds.length && orderIds.length > 0 ? 'Deselect all' : 'Select all'}
        </button>
      </div>
    </div>
  );
}
