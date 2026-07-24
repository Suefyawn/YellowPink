'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProductTile } from '@/components/ui/ProductTile';
import { track } from '@/lib/analytics';
import type { Product } from '@/types';

// Grid + toolbar for a curated collection: product count, sort, category chips
// scoped to the collection's OWN categories, and pagination — the essentials of
// the /shop toolbar, without the shop's taxon tabs (which don't fit a hand-
// picked set that deliberately spans categories). URL-synced (?cat/?sort/?page)
// so a view is shareable and survives back/forward, matching /shop's behaviour.

type SortKey = 'featured' | 'price-low' | 'price-high' | 'name';
const PAGE_SIZE = 24;
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-low', label: 'Price: Low → High' },
  { value: 'price-high', label: 'Price: High → Low' },
  { value: 'name', label: 'Name A–Z' },
];

export function CollectionGrid({ products, basePath }: { products: Product[]; basePath: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  const urlSort = (sp.get('sort') as SortKey | null) ?? 'featured';
  const sort: SortKey = SORTS.some(s => s.value === urlSort) ? urlSort : 'featured';
  const cat = sp.get('cat') ?? 'All';
  const page = Math.max(1, Number(sp.get('page') ?? '1') || 1);

  // Local mirror so the controls feel instant; the URL is the source of truth.
  const [pendingSort, setPendingSort] = useState<SortKey>(sort);

  // Categories actually present in this collection → chips. Hidden when the
  // whole collection is one category (a chip row of one is noise).
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.category) set.add(p.category);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const setParams = useCallback((next: Record<string, string | null>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '' || v === 'All' || (k === 'page' && v === '1')) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    // scroll:false so applying a filter doesn't jump the viewport to the top.
    router.replace(`${basePath}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [router, sp, basePath]);

  const filtered = useMemo(() => {
    let list = cat === 'All' ? products : products.filter(p => p.category === cat);
    if (sort === 'price-low') list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === 'price-high') list = [...list].sort((a, b) => b.price - a.price);
    else if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    // 'featured' keeps the collection's resolved order (manual position / smart order).
    return list;
  }, [products, cat, sort]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const clampedPage = Math.min(page, Math.max(1, totalPages));
  const paginated = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--ink-900)' : 'var(--line)'}`,
    background: active ? 'var(--ink-900)' : 'var(--paper)',
    color: active ? 'var(--paper)' : 'var(--ink-700)',
    fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: active ? 600 : 500,
    whiteSpace: 'nowrap',
  });

  const pageBtn = (active: boolean): React.CSSProperties => ({
    minWidth: 38, padding: '7px 11px', borderRadius: 'var(--radius-card)',
    border: `1px solid ${active ? 'var(--ink-900)' : 'var(--line)'}`,
    background: active ? 'var(--ink-900)' : 'var(--paper)',
    color: active ? 'var(--paper)' : 'var(--ink-700)',
    fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: active ? 600 : 500,
    cursor: 'pointer', textDecoration: 'none', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center',
  });

  const pageNumbers: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (clampedPage > 3) pageNumbers.push('…');
    for (let i = Math.max(2, clampedPage - 1); i <= Math.min(totalPages - 1, clampedPage + 1); i++) pageNumbers.push(i);
    if (clampedPage < totalPages - 2) pageNumbers.push('…');
    pageNumbers.push(totalPages);
  }

  return (
    <div>
      {/* Toolbar: category chips (if >1) + count + sort */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 'var(--gutter)' }}>
        {categories.length > 1 ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
            <button type="button" className="shop-tap" style={chipStyle(cat === 'All')} onClick={() => setParams({ cat: null, page: null })}>All</button>
            {categories.map(c => (
              <button key={c} type="button" className="shop-tap" style={chipStyle(cat === c)} onClick={() => setParams({ cat: c, page: null })}>{c}</button>
            ))}
          </div>
        ) : <span />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span className="small-text">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</span>
          <select
            value={pendingSort}
            aria-label="Sort products"
            className="shop-tap"
            onChange={e => { const s = e.target.value as SortKey; setPendingSort(s); setParams({ sort: s === 'featured' ? null : s, page: null }); track({ name: 'select_sort', payload: { sort: s } }); }}
            style={{
              padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
              background: 'var(--paper)', fontFamily: 'var(--font-ui)', fontSize: '0.8125rem',
              color: 'var(--ink-900)', cursor: 'pointer', outline: 'none',
            }}
          >
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {paginated.length > 0 ? (
        <div className="product-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }}>
          {/* First four tiles on page 1 are the likely LCP candidates: preload
              them and skip the hydration-gated fade (see ProductImage). */}
          {paginated.map((p, i) => <ProductTile key={p.id} product={p} list="Collection" priority={clampedPage === 1 && i < 4} />)}
        </div>
      ) : (
        <p className="body-text" style={{ color: 'var(--ink-700)' }}>No products match this filter.</p>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 'var(--section-gap)' }}>
          <button type="button" className="shop-tap" disabled={clampedPage <= 1} style={{ ...pageBtn(false), opacity: clampedPage <= 1 ? 0.4 : 1, cursor: clampedPage <= 1 ? 'not-allowed' : 'pointer' }}
            onClick={() => setParams({ page: String(clampedPage - 1) })} aria-label="Previous page">‹</button>
          {pageNumbers.map((p, i) => p === '…'
            ? <span key={`e${i}`} style={{ color: 'var(--ink-500)', padding: '0 4px' }}>…</span>
            : <button key={p} type="button" className="shop-tap" style={pageBtn(p === clampedPage)} onClick={() => setParams({ page: p === 1 ? null : String(p) })} aria-current={p === clampedPage ? 'page' : undefined}>{p}</button>)}
          <button type="button" className="shop-tap" disabled={clampedPage >= totalPages} style={{ ...pageBtn(false), opacity: clampedPage >= totalPages ? 0.4 : 1, cursor: clampedPage >= totalPages ? 'not-allowed' : 'pointer' }}
            onClick={() => setParams({ page: String(clampedPage + 1) })} aria-label="Next page">›</button>
        </div>
      )}
    </div>
  );
}
