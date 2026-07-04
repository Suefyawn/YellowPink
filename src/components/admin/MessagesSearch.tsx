'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useTransition } from 'react';
import { SearchInput } from '@/components/admin/SearchInput';

// Debounced live search for the messages inbox (OrdersFilter pattern):
// pushes ?q= and the server filters the threaded conversations by
// name / email / subject.

export function MessagesSearch() {
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
      startTransition(() => router.push(`/admin/messages${next.size ? `?${next.toString()}` : ''}`));
    }, 300);
  };

  return (
    <SearchInput
      type="search"
      urlValue={q}
      onSearch={setSearch}
      placeholder="Search name, email or subject…"
      aria-label="Search conversations"
      style={{
        padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8,
        fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
        minWidth: 220,
      }}
    />
  );
}
