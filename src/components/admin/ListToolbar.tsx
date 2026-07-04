'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useRef, useTransition } from 'react';
import { SearchInput } from '@/components/admin/SearchInput';

// URL-synced list toolbar for the URL-centric admin tools (Indexing, Broken
// links): saved-view underline tabs with counts, optional type pills, an
// optional sort select and a debounced search — the same control grammar as
// the Orders list, driven entirely by query params so views are shareable.
export function ListToolbar({
  views,
  defaultView,
  typeOptions,
  sortOptions,
  defaultSort,
  searchPlaceholder = 'Search…',
}: {
  views: { value: string; label: string; count?: number }[];
  defaultView: string;
  typeOptions?: { value: string; label: string }[];
  sortOptions?: { value: string; label: string }[];
  defaultSort?: string;
  searchPlaceholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const view = params.get('view') ?? defaultView;
  const type = params.get('type') ?? 'all';
  const sort = params.get('sort') ?? defaultSort ?? '';
  const q = params.get('q') ?? '';

  const set = (key: string, value: string, defaultValue: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === defaultValue) next.delete(key); else next.set(key, value);
    next.delete('page');
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  };

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setSearch = (v: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => set('q', v, ''), 300);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #e5e7eb' }}>
        {views.map(v => {
          const isActive = view === v.value;
          return (
            <button key={v.value} onClick={() => set('view', v.value, defaultView)} style={{
              padding: '9px 14px', border: 'none', cursor: 'pointer', background: 'transparent',
              fontSize: '0.8125rem', fontWeight: isActive ? 600 : 500,
              color: isActive ? '#111827' : '#6b7280',
              borderBottom: `2px solid ${isActive ? '#C5286A' : 'transparent'}`,
              marginBottom: -1,
            }}>
              {v.label}{v.count != null ? ` (${v.count})` : ''}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {typeOptions && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[{ value: 'all', label: 'All types' }, ...typeOptions].map(t => {
              const isActive = type === t.value;
              return (
                <button key={t.value} onClick={() => set('type', t.value, 'all')} style={{
                  padding: '5px 12px', borderRadius: 16, border: 'none', cursor: 'pointer',
                  fontSize: '0.75rem', fontWeight: isActive ? 600 : 400,
                  background: isActive ? '#111827' : '#f3f4f6',
                  color: isActive ? '#f9fafb' : '#6b7280',
                }}>
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
        <SearchInput
          urlValue={q}
          onSearch={setSearch}
          placeholder={searchPlaceholder}
          aria-label="Search"
          style={{
            padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8,
            fontSize: '0.8125rem', color: '#111827', background: 'white', outline: 'none',
            fontFamily: 'monospace', flex: '1 1 220px', minWidth: 160,
          }}
        />
        {sortOptions && (
          <select
            aria-label="Sort"
            value={sort}
            onChange={e => set('sort', e.target.value, defaultSort ?? '')}
            style={{ padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.8125rem', background: 'white', color: '#374151' }}
          >
            {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}
