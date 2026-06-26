'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useTransition } from 'react';
import { TAXONS, ALL_CATEGORIES, findTaxon } from '@/lib/category-taxonomy';

const TAGS = ['New', 'Sale', 'Bestseller', 'Featured', 'Limited'];
const SORTS: { value: string; label: string }[] = [
  { value: 'newest',     label: 'Newest first' },
  { value: 'name',       label: 'Name A–Z' },
  { value: 'price_high', label: 'Price: high to low' },
  { value: 'price_low',  label: 'Price: low to high' },
  { value: 'stock_low',  label: 'Stock: low to high' },
  { value: 'stock_high', label: 'Stock: high to low' },
];
const STOCKS: { value: string; label: string }[] = [
  { value: '',        label: 'Any stock' },
  { value: 'in',      label: 'In stock' },
  { value: 'low',     label: 'Low stock (≤10)' },
  { value: 'out',     label: 'Out of stock' },
  { value: 'managed', label: 'Externally managed' },
];

const STATUS_TABS: { value: string; label: string; key: 'all' | 'published' | 'draft' | 'archived'; color: string }[] = [
  { value: 'all',       label: 'All',       key: 'all',       color: '#111827' },
  { value: 'published', label: 'Published', key: 'published', color: '#16a34a' },
  { value: 'draft',     label: 'Drafts',    key: 'draft',     color: '#6b7280' },
  { value: 'archived',  label: 'Archived',  key: 'archived',  color: '#dc2626' },
];

interface Props {
  total: number;
  statusCounts: { published: number; draft: number; archived: number; all: number };
  categories: string[];
  brands: string[];
}

export function ProductsFilter({ total, statusCounts, categories, brands }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const status = params.get('status') ?? 'all';
  const category = params.get('category') ?? '';
  const brand = params.get('brand') ?? '';
  const tag = params.get('tag') ?? '';
  const stock = params.get('stock') ?? '';
  const q = params.get('q') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const min = params.get('min') ?? '';
  const max = params.get('max') ?? '';

  // Normalise the selected category to a value that matches an <option>: a
  // taxon collapses to its key, a leaf stays as-is.
  const categoryValue = category ? (findTaxon(category)?.key ?? category) : '';
  // Categories present in the catalogue but outside the nav taxonomy.
  const otherCategories = categories.filter(c => !ALL_CATEGORIES.includes(c));

  const push = useCallback((next: URLSearchParams) => {
    startTransition(() => router.push(`/admin/products?${next.toString()}`));
  }, [router]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === 'all') next.delete(key); else next.set(key, value);
    next.delete('page');
    push(next);
  };

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setDebounced = (key: string, v: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (v) next.set(key, v); else next.delete(key);
      next.delete('page');
      push(next);
    }, 350);
  };

  const setSort = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === 'newest') next.delete('sort'); else next.set('sort', value);
    next.delete('page');
    push(next);
  };

  const clearAll = () => push(new URLSearchParams());
  const hasFilters = !!category || !!brand || !!tag || !!stock || !!q || !!min || !!max;

  const selectStyle: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8,
    fontSize: '0.8125rem', color: '#111827', background: 'white', cursor: 'pointer', maxWidth: 200,
  };
  const numStyle: React.CSSProperties = {
    padding: '7px 8px', border: '1px solid #d1d5db', borderRadius: 8,
    fontSize: '0.8125rem', color: '#111827', background: 'white', width: 84,
  };

  return (
    <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Status tabs — manage draft vs live at a glance. */}
      <div className="adm-status-tabs" style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
        {STATUS_TABS.map(t => {
          const active = status === t.value;
          const count = statusCounts[t.key];
          return (
            <button
              key={t.value}
              onClick={() => setParam('status', t.value)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px',
                background: 'none', border: 'none', borderBottom: `2px solid ${active ? t.color : 'transparent'}`,
                marginBottom: -1, cursor: 'pointer', fontSize: '0.875rem',
                fontWeight: active ? 700 : 500, color: active ? '#111827' : '#6b7280',
              }}
            >
              {t.label}
              <span style={{
                fontSize: '0.6875rem', fontWeight: 700, padding: '1px 7px', borderRadius: 20,
                background: active ? `${t.color}1a` : '#f3f4f6', color: active ? t.color : '#9ca3af',
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Column filters. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input
          key={q}
          defaultValue={q}
          onChange={e => setDebounced('q', e.target.value)}
          placeholder="Search brand or name…"
          style={{
            padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8,
            fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none', minWidth: 190,
          }}
        />

        {/* Category — taxon groups + their leaves, plus any extra catalogue values. */}
        <select value={categoryValue} onChange={e => setParam('category', e.target.value)} style={selectStyle} aria-label="Filter by category">
          <option value="">All categories</option>
          {TAXONS.map(tx => (
            <optgroup key={tx.key} label={tx.label}>
              <option value={tx.key}>All {tx.label}</option>
              {tx.categories.map(c => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          ))}
          {otherCategories.length > 0 && (
            <optgroup label="Other">
              {otherCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          )}
        </select>

        {/* Brand */}
        <select value={brand} onChange={e => setParam('brand', e.target.value)} style={selectStyle} aria-label="Filter by brand">
          <option value="">All brands</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        {/* Stock state */}
        <select value={stock} onChange={e => setParam('stock', e.target.value)} style={selectStyle} aria-label="Filter by stock">
          {STOCKS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {/* Tag */}
        <select value={tag} onChange={e => setParam('tag', e.target.value)} style={selectStyle} aria-label="Filter by tag">
          <option value="">All tags</option>
          {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Price range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: '#6b7280' }}>
          <span>PKR</span>
          <input key={`min${min}`} defaultValue={min} onChange={e => setDebounced('min', e.target.value.replace(/\D/g, ''))} placeholder="min" inputMode="numeric" style={numStyle} aria-label="Min price" />
          <span>–</span>
          <input key={`max${max}`} defaultValue={max} onChange={e => setDebounced('max', e.target.value.replace(/\D/g, ''))} placeholder="max" inputMode="numeric" style={numStyle} aria-label="Max price" />
        </div>

        {hasFilters && (
          <button onClick={clearAll} style={{
            padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
            fontSize: '0.8125rem', color: '#6b7280', background: 'white', cursor: 'pointer',
          }}>
            Clear ✕
          </button>
        )}

        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: '#6b7280' }}>
          Sort
          <select value={sort} onChange={e => setSort(e.target.value)} style={selectStyle}>
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
          {total} product{total !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
