'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';

const CATEGORIES = ['All', 'Makeup', 'Skincare', 'Wellness'];
const TAGS = ['All', 'New', 'Sale', 'Bestseller', 'Featured', 'Limited'];

export function ProductsFilter({ total }: { total: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const category = params.get('category') ?? 'All';
  const tag = params.get('tag') ?? 'All';
  const q = params.get('q') ?? '';

  const push = useCallback((next: URLSearchParams) => {
    startTransition(() => router.push(`/admin/products?${next.toString()}`));
  }, [router]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    value === 'All' || value === 'all' ? next.delete(key) : next.set(key, value);
    push(next);
  };

  let debounce: ReturnType<typeof setTimeout>;
  const setSearch = (v: string) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      v ? next.set('q', v) : next.delete('q');
      push(next);
    }, 350);
  };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
    fontSize: '0.8125rem', fontWeight: active ? 600 : 400,
    background: active ? '#111827' : '#f3f4f6',
    color: active ? 'white' : '#6b7280',
  });

  return (
    <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setParam('category', c)} style={btnStyle(category === c)}>{c}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {TAGS.map(t => (
            <button key={t} onClick={() => setParam('tag', t)} style={btnStyle(tag === t)}>{t}</button>
          ))}
        </div>
        <input
          defaultValue={q}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search brand or name…"
          style={{
            padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8,
            fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none', minWidth: 200,
          }}
        />
        <span style={{ fontSize: '0.8125rem', color: '#9ca3af', marginLeft: 'auto' }}>{total} product{total !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
