'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useTransition } from 'react';

export function UsersFilter({ total }: { total: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const q = params.get('q') ?? '';

  const push = useCallback((next: URLSearchParams) => {
    startTransition(() => router.push(`/admin/users?${next.toString()}`));
  }, [router]);

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

  const clearAll = () => {
    push(new URLSearchParams());
  };

  const hasFilters = !!q;

  return (
    <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      <input
        defaultValue={q}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by email, name…"
        style={{
          padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8,
          fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
          minWidth: 240,
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
        {total} customer{total !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
