'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useTransition } from 'react';

const STATUSES = [
  { value: 'all',        label: 'All' },
  { value: 'pending',    label: 'Pending',    color: '#f59e0b' },
  { value: 'processing', label: 'Processing', color: '#3b82f6' },
  { value: 'shipped',    label: 'Shipped',    color: '#8b5cf6' },
  { value: 'delivered',  label: 'Delivered',  color: '#10b981' },
  { value: 'cancelled',  label: 'Cancelled',  color: '#ef4444' },
];

export function OrdersFilter({ total }: { total: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const status = params.get('status') ?? 'all';
  const q = params.get('q') ?? '';

  const push = useCallback((next: URLSearchParams) => {
    startTransition(() => router.push(`/admin/orders?${next.toString()}`));
  }, [router]);

  const setStatus = (s: string) => {
    const next = new URLSearchParams(params.toString());
    if (s === 'all') { next.delete('status'); } else { next.set('status', s); }
    next.delete('page');
    push(next);
  };

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setSearch = (v: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (v) { next.set('q', v); } else { next.delete('q'); }
      next.delete('page');
      push(next);
    }, 350);
  };

  return (
    <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {STATUSES.map(s => (
          <button key={s.value} onClick={() => setStatus(s.value)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: '0.8125rem', fontWeight: status === s.value ? 600 : 400,
            background: status === s.value ? (s.color ? s.color + '20' : '#111827') : '#f3f4f6',
            color: status === s.value ? (s.color ?? '#f9fafb') : '#6b7280',
            outline: status === s.value ? `2px solid ${s.color ?? '#111827'}` : 'none',
            outlineOffset: -2,
          }}>
            {s.label}
          </button>
        ))}
      </div>
      <input
        defaultValue={q}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search order # or customer…"
        style={{
          padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8,
          fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
          minWidth: 220,
        }}
      />
      <span style={{ fontSize: '0.8125rem', color: '#9ca3af', marginLeft: 'auto' }}>{total} order{total !== 1 ? 's' : ''}</span>
    </div>
  );
}
