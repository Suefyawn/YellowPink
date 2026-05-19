'use client';

import Link from 'next/link';
import Image from 'next/image';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import type { Product } from '@/types';

const PILLARS = [
  { label: "Women's Health", desc: 'Fertility, prenatal, hormonal balance' },
  { label: "Men's Vitality", desc: 'Performance, stamina, reproductive health' },
  { label: 'Immune Support', desc: 'Defense, zinc, daily wellness' },
  { label: 'Bone & Joint', desc: 'Calcium D3, mobility, strength' },
];

export function WellnessSection({ products }: { products: Product[] }) {
  const wellnessProducts = products.slice(0, 3);
  return (
    <section style={{ padding: 'var(--section-gap) 0' }}>
      <div className="container">
        <SectionDivider />
        <div style={{ marginTop: 'var(--section-gap)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start', marginBottom: 48 }} className="duo-grid">
            <div>
              <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Beyond Beauty</Overline>
              <h2 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 16 }}>
                Beauty starts<br /><em style={{ fontStyle: 'italic' }}>from within.</em>
              </h2>
              <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 400 }}>
                Clinical-grade nutraceuticals for fertility, immunity, bone health, and daily vitality.
                Because real beauty is health — inside out.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="duo-grid">
              {PILLARS.map((p) => (
                <div key={p.label} style={{
                  padding: 16, background: 'var(--paper2)', borderRadius: 'var(--radius-card)',
                  border: '1px solid var(--line)', cursor: 'pointer',
                  transition: 'border-color 180ms ease-out',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-yellow)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}
                >
                  <div style={{ width: 24, height: 4, background: 'var(--brand-yellow)', borderRadius: 2, marginBottom: 10 }} />
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 2 }}>{p.label}</div>
                  <div className="small-text" style={{ lineHeight: 1.4 }}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, 1fr)', gap: 'var(--gutter)', alignItems: 'center' }} className="wellness-grid">
            <div style={{ aspectRatio: '3/4', borderRadius: 'var(--radius-card)', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' }}>
              <Image
                src="https://yellowpink.pk/wp-content/uploads/2026/01/Untitled-1-08.webp"
                alt="Wellness supplements"
                fill
                // ¼ of grid on desktop, full-bleed on mobile (per .wellness-grid).
                sizes="(max-width: 900px) 100vw, 25vw"
                style={{ objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', top: 20, left: 20, background: 'var(--brand-yellow)', padding: '6px 12px', borderRadius: 'var(--radius-pill)' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-900)' }}>New Category</span>
              </div>
            </div>
            {wellnessProducts.map((p) => (
              <ProductTile key={p.id} product={p} />
            ))}
          </div>

          <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
            <Link href="/shop?category=Wellness" className="btn-secondary">Explore Wellness</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
