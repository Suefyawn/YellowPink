'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useTransition } from 'react';
import { SearchInput } from '@/components/admin/SearchInput';

// Live filter bar for the email log (AuditFilters pattern): debounced
// recipient/subject search + onChange kind select. Status filtering lives in
// the ViewTabs above the list.
export function EmailFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const q = params.get('q') ?? '';
  const kind = params.get('kind') ?? '';

  const push = useCallback((next: URLSearchParams) => {
    next.delete('page');
    startTransition(() => router.push(`/admin/emails${next.size ? `?${next.toString()}` : ''}`));
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
        placeholder="Search recipient or subject…"
        aria-label="Search emails"
        style={{
          padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8,
          fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
          minWidth: 260,
        }}
      />
      <select
        value={kind}
        onChange={e => setParam('kind', e.target.value)}
        aria-label="Email type"
        style={{
          padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7,
          fontSize: '0.8125rem', background: 'white', color: '#111827',
        }}
      >
        <option value="">All types</option>
        <option value="transactional">Transactional (orders, resets)</option>
        <option value="batch">Batch (newsletter, alerts)</option>
      </select>
      {(q || kind) && (
        <button
          type="button"
          onClick={() => push(new URLSearchParams(params.get('status') ? { status: params.get('status')! } : {}))}
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
