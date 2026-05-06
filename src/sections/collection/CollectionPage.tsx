'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import type { Product } from '@/types';

const CATEGORIES = ['All', 'Makeup', 'Skincare', 'Wellness', 'Lip Tints', 'Foundations', 'Blush', 'Highlighters', 'Sunscreen', 'Concealers'];

const CATEGORY_MAP: Record<string, (p: Product) => boolean> = {
  All: () => true,
  Makeup: p => ['Concealers', 'Foundations', 'Blush', 'Highlighters', 'Lip Tints'].includes(p.category),
  Skincare: p => p.category === 'Skincare' || p.category === 'Sunscreen',
  Wellness: p => p.category === 'Wellness',
};

type SortKey = 'featured' | 'price-low' | 'price-high' | 'name';

export function CollectionPage({ products, initialCategory = 'All' }: { products: Product[]; initialCategory?: string }) {
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState<SortKey>('featured');

  const filterFn = CATEGORY_MAP[activeCategory] ?? ((p: Product) => p.category === activeCategory);
  let filtered = products.filter(filterFn);
  if (sortBy === 'price-low') filtered = [...filtered].sort((a, b) => a.price - b.price);
  else if (sortBy === 'price-high') filtered = [...filtered].sort((a, b) => b.price - a.price);
  else if (sortBy === 'name') filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <section style={{ padding: '48px 0 0', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Shop</Overline>
          <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>
            {activeCategory === 'All' ? 'All Products' : activeCategory}
          </h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 480, marginBottom: 32 }}>
            {activeCategory === 'Wellness'
              ? 'Clinical-grade nutraceuticals for fertility, immunity, and daily vitality.'
              : 'Imported, authentic, and tested for Pakistani skin. Every product earns its place.'}
          </p>
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto', borderBottom: '1px solid var(--line)', marginBottom: -1 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 500,
                color: activeCategory === cat ? 'var(--ink-900)' : 'var(--ink-500)',
                borderBottom: activeCategory === cat ? '2px solid var(--ink-900)' : '2px solid transparent',
                transition: 'color 150ms, border-color 150ms',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>{cat}</button>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: 'var(--section-gap) 0' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <span className="small-text">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="small-text">Sort by</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} style={{
                padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
                background: 'var(--paper)', fontFamily: 'var(--font-ui)', fontSize: '0.8125rem',
                color: 'var(--ink-900)', cursor: 'pointer', outline: 'none',
              }}>
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low → High</option>
                <option value="price-high">Price: High → Low</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }} className="product-grid">
            {filtered.map((p) => (
              <Link key={p.id} href={`/product/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <ProductTile product={p} />
              </Link>
            ))}
          </div>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <p className="body-text" style={{ color: 'var(--ink-500)' }}>No products in this category yet.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
