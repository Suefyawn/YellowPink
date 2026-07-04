'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useTransition } from 'react';
import { SearchInput } from '@/components/admin/SearchInput';

// Debounced live search for the Brands list (MessagesSearch/OrdersFilter
// pattern) — replaces the old submit-to-search GET form, the last page still
// requiring an Enter press to filter (2026-07 filter-grammar convergence).
export function BrandsSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const q = params.get('q') ?? '';

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setSearch = (v: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (v) { next.set('q', v); } else { next.delete('q'); }
      startTransition(() => router.push(`/admin/brands${next.size ? `?${next.toString()}` : ''}`));
    }, 300);
  };

  return (
    <SearchInput
      type="search"
      urlValue={q}
      onSearch={setSearch}
      placeholder="Search name or slug…"
      aria-label="Search brands"
      style={{
        padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8,
        fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
        minWidth: 220,
      }}
    />
  );
}
