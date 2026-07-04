'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useTransition } from 'react';
import { SearchInput } from '@/components/admin/SearchInput';

// Debounced search box for the inventory stock-levels list. Pushes `?q=` and
// (because searching should span the whole catalogue, not just the current
// "needs attention" slice) clears the `view` param so matches always show.
export function InventoryStockSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const q = params.get('q') ?? '';
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = (v: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (v) { next.set('q', v); next.delete('view'); } else { next.delete('q'); }
      startTransition(() => router.push(`/admin/inventory?${next.toString()}`));
    }, 250);
  };

  return (
    <SearchInput
      urlValue={q}
      onSearch={run}
      placeholder="Search product…"
      aria-label="Search stock by product"
      style={{
        padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 8,
        fontSize: '0.8125rem', color: '#111827', background: 'white', outline: 'none',
        minWidth: 160, opacity: pending ? 0.6 : 1,
      }}
    />
  );
}
