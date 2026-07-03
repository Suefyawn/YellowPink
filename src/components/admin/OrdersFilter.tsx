'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useTransition } from 'react';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/types';

// Saved-view tabs (Shopify's orders-index pattern): the workflow views an
// operator actually lives in, not one pill per raw status. 'tofulfil' and
// 'unpaid' are composite views resolved server-side (admin/orders/page.tsx +
// exportOrdersCsv); the rest map to single statuses. Less-used statuses
// (awaiting/failed payment, returned) stay reachable via the More dropdown.
const VIEWS: { value: string; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'tofulfil',  label: 'To fulfil' },
  { value: 'unpaid',    label: 'Unpaid' },
  { value: 'shipped',   label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];
const MORE_STATUSES = (Object.keys(ORDER_STATUS_LABELS) as OrderStatus[])
  .filter(s => !VIEWS.some(v => v.value === s));

// Quick "show me orders from the last X days" presets. `all` clears the date
// filter so the page falls back to the full history.
const RANGES: { value: string; label: string }[] = [
  { value: 'all',  label: 'All time' },
  { value: '1d',   label: 'Today' },
  { value: '7d',   label: 'Last 7d' },
  { value: '30d',  label: 'Last 30d' },
  { value: '90d',  label: 'Last 90d' },
];

export function OrdersFilter({ total }: { total: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const status = params.get('status') ?? 'all';
  const q = params.get('q') ?? '';
  const range = params.get('range') ?? 'all';

  // Remember the active list query so the order-detail "← Orders" link can
  // return the staffer to the exact filtered/searched view they came from.
  useEffect(() => {
    const qs = params.toString();
    try { sessionStorage.setItem('adminOrdersQuery', qs ? `?${qs}` : ''); } catch { /* private mode */ }
  }, [params]);

  const push = useCallback((next: URLSearchParams) => {
    startTransition(() => router.push(`/admin/orders?${next.toString()}`));
  }, [router]);

  const setStatus = (s: string) => {
    const next = new URLSearchParams(params.toString());
    if (s === 'all') { next.delete('status'); } else { next.set('status', s); }
    next.delete('page');
    push(next);
  };

  const setRange = (r: string) => {
    const next = new URLSearchParams(params.toString());
    if (r === 'all') { next.delete('range'); } else { next.set('range', r); }
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
    }, 300);
  };

  const clearAll = () => push(new URLSearchParams());
  const hasFilters = status !== 'all' || !!q || range !== 'all';

  return (
    <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      <div className="adm-filter-pills" style={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #e5e7eb', flexBasis: '100%' }}>
        {VIEWS.map(v => {
          const isActive = status === v.value;
          return (
            <button key={v.value} onClick={() => setStatus(v.value)} style={{
              padding: '9px 14px', border: 'none', cursor: 'pointer', background: 'transparent',
              fontSize: '0.8125rem', fontWeight: isActive ? 600 : 500,
              color: isActive ? '#111827' : '#6b7280',
              borderBottom: `2px solid ${isActive ? '#C5286A' : 'transparent'}`,
              marginBottom: -1,
            }}>
              {v.label}
            </button>
          );
        })}
        <select
          aria-label="More statuses"
          value={MORE_STATUSES.includes(status as OrderStatus) ? status : ''}
          onChange={e => e.target.value && setStatus(e.target.value)}
          style={{
            marginLeft: 4, padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 7,
            fontSize: '0.75rem', background: 'white',
            color: MORE_STATUSES.includes(status as OrderStatus) ? '#111827' : '#6b7280',
            fontWeight: MORE_STATUSES.includes(status as OrderStatus) ? 600 : 400,
          }}
        >
          <option value="">More…</option>
          {MORE_STATUSES.map(s => (
            <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>
      <input
        key={q}
        defaultValue={q}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search order #, name, email or phone…"
        style={{
          padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8,
          fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
          minWidth: 220,
        }}
      />
      {hasFilters && (
        <button onClick={clearAll} style={{
          padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
          fontSize: '0.8125rem', color: '#6b7280', background: 'white', cursor: 'pointer',
        }}>
          Clear ✕
        </button>
      )}
      <span style={{ fontSize: '0.8125rem', color: '#9ca3af', marginLeft: 'auto' }}>
        {total} order{total !== 1 ? 's' : ''}
      </span>
    </div>
    <div className="adm-filter-pills" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 6 }}>
        Placed
      </span>
      {RANGES.map(r => {
        const isActive = range === r.value;
        return (
          <button key={r.value} onClick={() => setRange(r.value)} style={{
            padding: '5px 12px', borderRadius: 16, border: 'none', cursor: 'pointer',
            fontSize: '0.75rem', fontWeight: isActive ? 600 : 400,
            background: isActive ? '#111827' : '#f3f4f6',
            color: isActive ? '#f9fafb' : '#6b7280',
          }}>
            {r.label}
          </button>
        );
      })}
    </div>
    </div>
  );
}
