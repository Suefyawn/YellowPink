// The reverse of BundleContents: this product is a COMPONENT of one or more
// value sets, so show the sets it belongs to with the money saved. Turns
// every component PDP into a funnel toward the higher-basket bundle. Server
// component — pure display.

import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import type { Product } from '@/types';

export interface ContainingSet {
  bundle: Product;
  /** Sum of the set's components bought individually. */
  individualTotal: number;
}

export function PartOfSet({ productName, sets }: { productName: string; sets: ContainingSet[] }) {
  // Only sets that are genuinely cheaper earn the pitch.
  const worthShowing = sets.filter(s => {
    const saving = s.individualTotal - s.bundle.price;
    return saving > 0 && Math.round((saving / s.individualTotal) * 100) >= 1;
  });
  if (worthShowing.length === 0) return null;

  return (
    <section style={{ padding: 'var(--section-gap) 0', borderTop: '1px solid var(--line)' }}>
      <div className="container">
        <Overline as="h2" style={{ display: 'block', marginBottom: 8 }}>Better Value In A Set</Overline>
        <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 20 }}>
          {productName} costs less inside {worthShowing.length === 1 ? 'this set' : 'these sets'}.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          {worthShowing.map(({ bundle, individualTotal }) => {
            const saving = individualTotal - bundle.price;
            const pct = Math.round((saving / individualTotal) * 100);
            return (
              <Link
                key={bundle.id}
                href={`/product/${bundle.slug}`}
                style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', color: 'inherit', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 12 }}
              >
                <div style={{ width: 64, height: 72, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: 'var(--paper2)' }}>
                  <ProductImage src={bundle.image_url} alt={bundle.name} width={64} height={72} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.3 }}>{bundle.name}</div>
                  <div className="tabular-nums" style={{ fontSize: '0.8125rem', color: 'var(--ink-700)', marginTop: 4 }}>
                    <span style={{ textDecoration: 'line-through', color: 'var(--ink-500)' }}>PKR {individualTotal.toLocaleString()}</span>
                    {' '}<strong>PKR {bundle.price.toLocaleString()}</strong>
                    {' '}<span style={{ color: 'var(--brand-pink-text, #9d174d)', fontWeight: 600 }}>save PKR {saving.toLocaleString()} ({pct}%)</span>
                  </div>
                </div>
                <span aria-hidden="true" style={{ color: 'var(--ink-500)', flexShrink: 0 }}>→</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
