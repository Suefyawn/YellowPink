'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import type { Product } from '@/types';

const TOP_CATEGORIES = ['All', 'Makeup', 'Skincare', 'Wellness'];

const SUBCATEGORIES: Record<string, string[]> = {
  Makeup: ['Lip & Cheek Tints', 'Highlighters', 'Skin Makeup', 'Concealers', 'Contour Sticks', 'Foundations', 'Eyeshadow', 'Brushes'],
  Skincare: ['Skincare', 'Moisturizers', 'Hair Care'],
  Wellness: ['Health & Wellness', 'Human Health', 'Bone Health', 'Brain Health', 'Immune Support', 'Female Fertility & Reproductive Health', 'Digestive Health & Weight Management', 'Heart & Cardiovascular', 'Energy & Performance', 'Combo Packs', 'Pediatric Health', 'Sleep & Relaxation', 'Electrolyte Balance'],
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  All: 'Imported, authentic, and tested for Pakistani skin. Every product earns its place.',
  Makeup: 'Authentic imported makeup from the world\'s best brands, available in Pakistan.',
  Skincare: 'Science-backed skincare formulas that actually work on Pakistani skin.',
  Wellness: 'Clinical-grade nutraceuticals for fertility, immunity, and daily vitality.',
};

type SortKey = 'featured' | 'price-low' | 'price-high' | 'name';

export function CollectionPage({ products, initialCategory = 'All' }: { products: Product[]; initialCategory?: string }) {
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('featured');

  function handleTopCategory(cat: string) {
    setActiveCategory(cat);
    setActiveSubcategory(null);
  }

  let filtered = products.filter(p => {
    if (activeCategory !== 'All' && p.category !== activeCategory) return false;
    if (activeSubcategory && p.subcategory !== activeSubcategory) return false;
    return true;
  });

  if (sortBy === 'price-low') filtered = [...filtered].sort((a, b) => a.price - b.price);
  else if (sortBy === 'price-high') filtered = [...filtered].sort((a, b) => b.price - a.price);
  else if (sortBy === 'name') filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  const subcats = activeCategory !== 'All' ? SUBCATEGORIES[activeCategory] ?? [] : [];
  const pageTitle = activeSubcategory ?? (activeCategory === 'All' ? 'All Products' : activeCategory);

  return (
    <div>
      <section style={{ padding: '48px 0 0', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Shop</Overline>
          <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>{pageTitle}</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 480, marginBottom: 32 }}>
            {CATEGORY_DESCRIPTIONS[activeCategory] ?? CATEGORY_DESCRIPTIONS.All}
          </p>
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto', marginBottom: -1 }}>
            {TOP_CATEGORIES.map(cat => (
              <button key={cat} onClick={() => handleTopCategory(cat)} style={{
                padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 600,
                color: activeCategory === cat && !activeSubcategory ? 'var(--ink-900)' : 'var(--ink-500)',
                borderBottom: activeCategory === cat && !activeSubcategory ? '2px solid var(--ink-900)' : '2px solid transparent',
                transition: 'color 150ms, border-color 150ms',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>{cat}</button>
            ))}
          </div>
          {subcats.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 0', borderTop: '1px solid var(--line)' }}>
              {subcats.map(sub => (
                <button key={sub} onClick={() => setActiveSubcategory(activeSubcategory === sub ? null : sub)} style={{
                  padding: '6px 14px', background: activeSubcategory === sub ? 'var(--ink-900)' : 'transparent',
                  border: '1px solid', borderColor: activeSubcategory === sub ? 'var(--ink-900)' : 'var(--line)',
                  borderRadius: 100, cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 500,
                  color: activeSubcategory === sub ? 'var(--paper)' : 'var(--ink-700)',
                  transition: 'all 150ms',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>{sub}</button>
              ))}
            </div>
          )}
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
