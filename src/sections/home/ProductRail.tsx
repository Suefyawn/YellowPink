import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import type { Product } from '@/types';

// Generic homepage product rail: an overline + heading on the left of a header
// row, a "view all" link on the right, and a responsive tile grid beneath.
// Used for the data-driven Best Sellers and Trending Now sections so both share
// one layout and the page reads as a consistent set of rails.
export function ProductRail({
  overline,
  heading,
  blurb,
  ctaHref,
  ctaLabel,
  products,
  tinted = false,
}: {
  overline: string;
  heading: string;
  blurb?: string;
  ctaHref: string;
  ctaLabel: string;
  products: Product[];
  /** Paper-2 background + hairline borders, to alternate bands visually. */
  tinted?: boolean;
}) {
  const items = products.slice(0, 4);
  if (items.length === 0) return null;
  return (
    <section
      style={{
        padding: 'var(--section-gap) 0',
        ...(tinted
          ? { background: 'var(--paper2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }
          : {}),
      }}
    >
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <div>
            <Overline style={{ display: 'block', marginBottom: 10, color: 'var(--ink-500)' }}>{overline}</Overline>
            <h2 className="display-l" style={{ fontSize: '2rem', margin: 0 }}>{heading}</h2>
            {blurb && <p className="body-text" style={{ color: 'var(--ink-700)', margin: '10px 0 0', maxWidth: 460 }}>{blurb}</p>}
          </div>
          <Link href={ctaHref} className="btn-secondary" style={{ flex: '0 0 auto' }}>{ctaLabel}</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }} className="product-grid-4">
          {items.map(p => <ProductTile key={p.id} product={p} />)}
        </div>
      </div>
    </section>
  );
}
