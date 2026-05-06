'use client';

import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';

const CATS = ['Foundations', 'Lip Tints', 'Concealers', 'Skincare', 'Sunscreen', 'Blush', 'Highlighters', 'Wellness'];

export function CategoryTiles() {
  return (
    <section style={{ padding: 'var(--section-gap) 0' }}>
      <div className="container">
        <Overline style={{ display: 'block', marginBottom: 32 }}>Categories</Overline>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }} className="cat-grid">
          {CATS.map(cat => (
            <Link key={cat} href={`/shop?category=${cat}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ overflow: 'hidden', borderRadius: 'var(--radius-card)' }}>
                <div className="img-placeholder" style={{ aspectRatio: '1' }}>
                  <span>{cat.toLowerCase()}</span>
                </div>
              </div>
              <Overline style={{ display: 'block', marginTop: 10, textAlign: 'center', color: 'var(--ink-700)' }}>{cat}</Overline>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
