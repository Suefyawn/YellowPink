'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useTransition } from 'react';
import { SearchInput } from '@/components/admin/SearchInput';

// Live filter bar for the activity log (OrdersFilter/ReviewsFilter pattern):
// debounced search + onChange time-range select, no submit button. Actor-kind
// filtering lives in the ViewTabs above the list.
const RANGES = [
  { value: '',    label: 'All time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d',  label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

export function AuditFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const q = params.get('q') ?? '';
  const range = params.get('range') ?? '';

  const push = useCallback((next: URLSearchParams) => {
    next.delete('page');
    startTransition(() => router.push(`/admin/audit${next.size ? `?${next.toString()}` : ''}`));
  }, [router]);

  const setParam = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) { next.set(key, value); } else { next.delete(key); }
    push(next);
  }, [params, push]);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setSearch = (v: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setParam('q', v), 300);
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '14px 0 16px' }}>
      <SearchInput
        type="search"
        urlValue={q}
        onSearch={setSearch}
        placeholder="Search event, email or entity id…"
        aria-label="Search activity"
        style={{
          padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8,
          fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
          minWidth: 260,
        }}
      />
      <select
        value={range}
        onChange={e => setParam('range', e.target.value)}
        aria-label="Time range"
        style={{
          padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7,
          fontSize: '0.8125rem', background: 'white', color: '#111827',
        }}
      >
        {RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      {(q || range) && (
        <button
          type="button"
          onClick={() => push(new URLSearchParams(params.get('actor') ? { actor: params.get('actor')! } : {}))}
          style={{
            padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
            fontSize: '0.8125rem', color: '#6b7280', background: 'white', cursor: 'pointer',
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
