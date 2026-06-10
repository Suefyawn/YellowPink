import Link from 'next/link';
import { ProductTile } from '@/components/ui/ProductTile';
import { K_BEAUTY_SHOP_URL } from '@/lib/k-beauty';
import type { Product } from '@/types';

// The three signature K-beauty claims, rendered as quiet chips between the
// header and the rail. Copy, not data — they describe the edit, not a product.
const RITUALS = [
  'Featherweight SPF 50+ PA++++',
  'Fermented, barrier-first formulas',
  'That glass-skin glow',
];

/** Homepage K-Beauty edit — a tinted campaign band for products from the
 *  curated Korean brand list (lib/k-beauty.ts). Self-hides while the catalog
 *  has no published K-beauty products, so the section can ship ahead of the
 *  range growing. */
export function KBeautySection({ products }: { products: Product[] }) {
  const items = products.slice(0, 3);
  if (items.length === 0) return null;
  return (
    <section style={{
      // Blush-to-cream wash — softer than the sale band's flat cream, so the
      // two read as different campaigns when both are on the page.
      background: 'linear-gradient(160deg, #fdf0f4 0%, var(--paper2, #faf6ee) 75%)',
      borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
      padding: 'var(--section-gap) 0',
    }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <span style={{
            display: 'inline-block', padding: '4px 14px', marginBottom: 12,
            background: '#fff', color: 'var(--brand-pink-text, #C5286A)',
            border: '1px solid var(--brand-pink, #C5286A)',
            borderRadius: 'var(--radius-pill, 999px)',
            fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            The K-Beauty Edit
          </span>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.02em',
            fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', margin: 0,
          }}>
            Glass skin, <em style={{ fontStyle: 'italic' }}>delivered.</em>
          </h2>
          <p className="body-text" style={{ color: 'var(--ink-700)', marginTop: 8, maxWidth: 520, marginInline: 'auto' }}>
            Cult Korean skincare — imported, 100% authentic, and straight from
            Seoul&apos;s shelves to your doorstep, anywhere in Pakistan.
          </p>
        </div>

        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
          gap: 10, marginBottom: 32,
        }}>
          {RITUALS.map((r) => (
            <span key={r} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', background: '#fff',
              border: '1px solid var(--line)', borderRadius: 'var(--radius-pill, 999px)',
              fontSize: '0.8125rem', color: 'var(--ink-700)',
            }}>
              <span aria-hidden="true" style={{ width: 14, height: 3, background: 'var(--brand-yellow)', borderRadius: 2 }} />
              {r}
            </span>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 'var(--gutter)', maxWidth: items.length < 3 ? 720 : undefined, marginInline: 'auto' }} className="product-grid-3">
          {items.map((p) => (
            <ProductTile key={p.id} product={p} />
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <Link href={K_BEAUTY_SHOP_URL} className="btn-secondary">Shop the K-Beauty Edit</Link>
        </div>
      </div>
    </section>
  );
}
