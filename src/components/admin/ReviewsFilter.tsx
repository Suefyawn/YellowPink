'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useTransition } from 'react';

// Live filter bar for the reviews list (BlogFilter/OrdersFilter pattern):
// debounced search plus onChange selects, no submit button. Param names
// (q / product / status) match what admin/reviews/page.tsx already reads.

export interface ReviewedProduct {
  id: string;
  label: string;
}

const selStyle: React.CSSProperties = {
  padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.8125rem', background: 'white', color: '#111827', maxWidth: 260,
};

export function ReviewsFilter({ products }: { products: ReviewedProduct[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const q = params.get('q') ?? '';
  const product = params.get('product') ?? '';
  const status = params.get('status') ?? 'all';

  const push = useCallback((next: URLSearchParams) => {
    startTransition(() => router.push(`/admin/reviews${next.size ? `?${next.toString()}` : ''}`));
  }, [router]);

  const setParam = useCallback((key: string, value: string, empty: string[] = ['']) => {
    const next = new URLSearchParams(params.toString());
    if (empty.includes(value)) { next.delete(key); } else { next.set(key, value); }
    next.delete('page');
    push(next);
  }, [params, push]);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setSearch = (v: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setParam('q', v), 300);
  };

  const hasFilters = !!q || !!product || status !== 'all';

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
      <input
        key={q}
        type="search"
        defaultValue={q}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search name or text…"
        aria-label="Search reviews"
        style={{
          padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8,
          fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
          minWidth: 220,
        }}
      />
      <select value={product} onChange={e => setParam('product', e.target.value)} aria-label="Filter by product" style={selStyle}>
        <option value="">All products</option>
        {products.map(p => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
      <select value={status} onChange={e => setParam('status', e.target.value, ['all', ''])} aria-label="Filter by status" style={selStyle}>
        <option value="all">All statuses</option>
        <option value="approved">Approved</option>
        <option value="pending">Pending</option>
      </select>
      {hasFilters && (
        <button type="button" onClick={() => push(new URLSearchParams())} style={{
          padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
          fontSize: '0.8125rem', color: '#6b7280', background: 'white', cursor: 'pointer',
        }}>
          Clear
        </button>
      )}
    </div>
  );
}
