// "What's inside" for bundle products: the exact components (linked), the
// sum of their individual prices, and the saving at the bundle price. Renders
// nothing for non-bundles. Server component — pure display, no state.

import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import { brandPlusName } from '@/lib/product-display';
import { bundleEconomics, type BundleComponentRow } from '@/lib/bundle-pricing';
import type { Product } from '@/types';

export function BundleContents({ bundle, components }: { bundle: Product; components: BundleComponentRow[] }) {
  if (components.length < 2) return null;
  const eco = bundleEconomics(bundle.price, components);

  return (
    <section style={{ padding: 'var(--section-gap) 0', borderTop: '1px solid var(--line)' }}>
      <div className="container">
        <Overline as="h2" style={{ display: 'block', marginBottom: 8 }}>What&apos;s Inside This Set</Overline>
        {/* A trivial saving ("PKR 10 (0% off)") reads worse than no claim. */}
        {eco.saving > 0 && Math.round(eco.savingPct) >= 1 && (
          <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 20 }}>
            Bought separately these cost <span className="tabular-nums" style={{ textDecoration: 'line-through' }}>PKR {eco.individualTotal.toLocaleString()}</span>.
            The set price of <strong className="tabular-nums">PKR {bundle.price.toLocaleString()}</strong> saves
            you <strong className="tabular-nums">PKR {eco.saving.toLocaleString()}</strong> ({Math.round(eco.savingPct)}% off).
          </p>
        )}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
          {components.map(c => (
            <li key={c.product.id}>
              <Link
                href={`/product/${c.product.slug}`}
                style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', color: 'inherit', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 10 }}
              >
                <div style={{ width: 56, height: 64, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: 'var(--paper2)' }}>
                  <ProductImage src={c.product.image_url} alt={c.product.name} width={56} height={64} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.3 }}>
                    {c.qty > 1 ? `${c.qty}× ` : ''}{brandPlusName(c.product.brand, c.product.name)}
                  </div>
                  <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--ink-500)', marginTop: 2 }}>
                    PKR {c.product.price.toLocaleString()} individually
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
