'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useTransition } from 'react';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'recent',     label: 'Recently joined' },
  { value: 'last_order', label: 'Recent order' },
  { value: 'spent',      label: 'Top spenders' },
  { value: 'orders',     label: 'Most orders' },
  { value: 'name',       label: 'Name A–Z' },
];

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all',        label: 'All' },
  { value: 'registered', label: 'Registered' },
  { value: 'guest',      label: 'Guests' },
];

const ACTIVITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all',    label: 'Any activity' },
  { value: 'repeat', label: 'Repeat (2+ orders)' },
  { value: 'one',    label: 'One order' },
  { value: 'none',   label: 'No orders yet' },
];

export function UsersFilter({ total }: { total: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const q = params.get('q') ?? '';
  const sort = params.get('sort') ?? 'recent';
  const type = params.get('type') ?? 'all';
  const activity = params.get('activity') ?? 'all';

  const push = useCallback((next: URLSearchParams) => {
    startTransition(() => router.push(`/admin/users?${next.toString()}`));
  }, [router]);

  // Reset to page 1 whenever a filter changes; drop params at their default.
  const setParam = useCallback((key: string, value: string, dflt: string) => {
    const next = new URLSearchParams(params.toString());
    if (value && value !== dflt) { next.set(key, value); } else { next.delete(key); }
    next.delete('page');
    push(next);
  }, [params, push]);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setSearch = (v: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setParam('q', v, ''), 300);
  };

  const clearAll = () => push(new URLSearchParams());
  const hasFilters = !!q || sort !== 'recent' || type !== 'all' || activity !== 'all';

  const controlStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8,
    fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
  };

  return (
    <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      {/* Search */}
      <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 220, maxWidth: 360 }}>
        <span aria-hidden="true" style={{
          position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
          color: '#9ca3af', fontSize: '0.875rem', pointerEvents: 'none',
        }}>⌕</span>
        <input
          defaultValue={q}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email or phone…"
          aria-label="Search customers"
          style={{ ...controlStyle, width: '100%', paddingLeft: 32 }}
        />
      </div>

      {/* Customer-type segmented control */}
      <div role="group" aria-label="Customer type" style={{
        display: 'inline-flex', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden', background: 'white',
      }}>
        {TYPE_OPTIONS.map((o, i) => {
          const active = type === o.value;
          return (
            <button
              key={o.value}
              onClick={() => setParam('type', o.value, 'all')}
              aria-pressed={active}
              style={{
                padding: '8px 14px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                border: 'none', borderLeft: i > 0 ? '1px solid #e5e7eb' : 'none',
                background: active ? '#111827' : 'transparent',
                color: active ? '#fff' : '#6b7280',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {/* Activity filter */}
      <select
        value={activity}
        onChange={e => setParam('activity', e.target.value, 'all')}
        aria-label="Filter by order activity"
        style={{ ...controlStyle, cursor: 'pointer' }}
      >
        {ACTIVITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Sort */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: '#6b7280' }}>
        Sort
        <select
          value={sort}
          onChange={e => setParam('sort', e.target.value, 'recent')}
          aria-label="Sort customers"
          style={{ ...controlStyle, cursor: 'pointer' }}
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>

      {hasFilters && (
        <button onClick={clearAll} style={{
          padding: '7px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
          fontSize: '0.8125rem', color: '#6b7280', background: 'white', cursor: 'pointer',
        }}>
          Clear ✕
        </button>
      )}

      <span style={{ fontSize: '0.8125rem', color: '#9ca3af', marginLeft: 'auto', opacity: isPending ? 0.5 : 1 }}>
        {total} result{total !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
