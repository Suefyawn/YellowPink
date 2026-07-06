'use client';

// Self-contained listing browser for brand / tag landing pages.
//
// Industry-standard collection-page UX (cf. Sephora/ASOS brand pages): a sort
// dropdown plus on-page filter facets, rather than bouncing the shopper to the
// Shop page to refine. It operates purely on the product array it's given
// (already visibility-filtered server-side) so it needs no URL plumbing, the
// heavyweight, URL-driven /shop CollectionPage stays the place for deep,
// shareable filtering.

import { useMemo, useState } from 'react';
import { ProductTile } from '@/components/ui/ProductTile';
import type { Product } from '@/types';

type SortKey = 'featured' | 'newest' | 'price-low' | 'price-high' | 'name';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'name', label: 'Name: A–Z' },
];

const inStock = (p: Product) => p.track_inventory === false || (p.stock ?? 0) > 0;

export function ProductBrowser({ products }: { products: Product[] }) {
  const [sortBy, setSortBy] = useState<SortKey>('featured');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [activeCats, setActiveCats] = useState<string[]>([]);
  const [activePackaging, setActivePackaging] = useState<string[]>([]);

  // Category facets, only worth showing when the set spans more than one.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  // Packaging facets (Tester / Without box). Only surfaced when this product
  // set actually contains non-standard packaging, so a normal brand page shows
  // no clutter.
  const PACKAGING_LABELS: Record<string, string> = { tester: 'Tester', no_box: 'Without box' };
  const packagings = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const pk = p.packaging;
      if (pk && pk !== 'standard') counts.set(pk, (counts.get(pk) ?? 0) + 1);
    }
    return [...counts.entries()].map(([value, count]) => ({ value, count }));
  }, [products]);

  const toggleCat = (c: string) =>
    setActiveCats(prev => (prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]));
  const togglePackaging = (v: string) =>
    setActivePackaging(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]));

  const visible = useMemo(() => {
    let list = products;
    if (inStockOnly) list = list.filter(inStock);
    if (activeCats.length) list = list.filter(p => p.category && activeCats.includes(p.category));
    if (activePackaging.length) list = list.filter(p => p.packaging && activePackaging.includes(p.packaging));

    const sorted = [...list];
    switch (sortBy) {
      case 'price-low': sorted.sort((a, b) => a.price - b.price); break;
      case 'price-high': sorted.sort((a, b) => b.price - a.price); break;
      case 'name': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'newest':
        sorted.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
        break;
      case 'featured':
      default:
        // Bestsellers, then featured, then catalogue order.
        sorted.sort((a, b) =>
          (Number(b.is_bestseller) - Number(a.is_bestseller)) ||
          (Number(b.is_featured) - Number(a.is_featured)));
        break;
    }
    return sorted;
  }, [products, sortBy, inStockOnly, activeCats, activePackaging]);

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 'var(--radius-pill, 999px)',
    border: '1px solid ' + (active ? 'var(--ink-900)' : 'var(--line)'),
    background: active ? 'var(--ink-900)' : 'var(--paper)',
    color: active ? 'var(--paper)' : 'var(--ink-900)',
    fontSize: '0.8125rem', cursor: 'pointer', whiteSpace: 'nowrap',
  });

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap', marginBottom: 20, paddingBottom: 16,
        borderBottom: '1px solid var(--line)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="small-text" style={{ color: 'var(--ink-500)', marginRight: 4 }}>
            {visible.length} {visible.length === 1 ? 'product' : 'products'}
          </span>
          {categories.length > 1 && (
            <>
              <button type="button" onClick={() => setActiveCats([])} style={chip(activeCats.length === 0)}>All</button>
              {categories.map(c => (
                <button key={c.name} type="button" onClick={() => toggleCat(c.name)} style={chip(activeCats.includes(c.name))}>
                  {c.name}
                </button>
              ))}
            </>
          )}
          {packagings.map(pk => (
            <button key={pk.value} type="button" onClick={() => togglePackaging(pk.value)} style={chip(activePackaging.includes(pk.value))}>
              {PACKAGING_LABELS[pk.value] ?? pk.value}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--ink-700)', cursor: 'pointer' }}>
            <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} />
            In stock
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--ink-700)' }}>
            <span>Sort</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortKey)}
              style={{
                padding: '8px 12px', borderRadius: 'var(--radius-card)',
                border: '1px solid var(--line)', background: 'var(--paper)',
                color: 'var(--ink-900)', fontSize: '0.8125rem', cursor: 'pointer',
              }}
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="product-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }}>
          {visible.map(p => <ProductTile key={p.id} product={p} />)}
        </div>
      ) : (
        <p className="body-text" style={{ color: 'var(--ink-700)', padding: '24px 0' }}>
          No products match these filters.{' '}
          <button type="button" onClick={() => { setActiveCats([]); setActivePackaging([]); setInStockOnly(false); }} className="text-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Clear filters
          </button>
        </p>
      )}
    </div>
  );
}
