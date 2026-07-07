'use client';

// Bundle widget on the PDP. Lists the top N co-purchased products from the
// frequently_bought_with RPC. "Add all to cart" applies every checked item.

import { useMemo, useState } from 'react';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import { StarRating } from '@/components/ui/StarRating';
import { useCart } from '@/context/CartContext';
import { brandPlusName } from '@/lib/product-display';
import type { Product } from '@/types';

/** A product the bundle can actually sell. Mirrors ProductTile's sold-out
 *  logic: tracked inventory at zero stock is unbuyable; externally-managed
 *  inventory (track_inventory === false) is always purchasable. Sold-out
 *  items are excluded from the widget entirely, adding one produced a
 *  quantity-0 phantom cart line (addToCart clamps to stock) that dead-ended
 *  checkout. */
function isPurchasable(p: Product): boolean {
  return !(p.track_inventory !== false && typeof p.stock === 'number' && p.stock <= 0);
}

export function FrequentlyBoughtTogether({
  anchor, suggestions,
}: {
  anchor: Product;
  suggestions: Product[];
}) {
  const { addToCart } = useCart();
  // Only in-stock items take part in the bundle. If the anchor itself is
  // sold out it's dropped too, the shopper can't buy it from the main CTA
  // either, so bundling it would only manufacture broken cart lines.
  const bundle = useMemo<Product[]>(
    () => [anchor, ...suggestions].filter(isPurchasable),
    [anchor, suggestions],
  );
  // Initialiser runs once per mount; the parent keys this component on the
  // product id so a related-product navigation re-seeds the selection.
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(bundle.map(p => [p.id, true]))
  );

  // Nothing to pair (or only the anchor survived the stock filter) → no widget.
  if (bundle.length < 2) return null;

  const allProducts = bundle;
  const total = allProducts
    .filter(p => checked[p.id])
    .reduce((s, p) => s + p.price, 0);

  const handleAddAll = () => {
    for (const p of allProducts) {
      if (!checked[p.id]) continue;
      // Skip the anchor, it's the product the user is already on. They can
      // add it via the main CTA. But if they want to add it directly through
      // the bundle, this still works.
      addToCart({ ...p, qty: 1 });
    }
  };

  return (
    <section style={{ padding: 'var(--section-gap) 0', borderTop: '1px solid var(--line)' }}>
      <div className="container">
        <Overline as="h2" style={{ display: 'block', marginBottom: 24 }}>Frequently Bought Together</Overline>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32, alignItems: 'start' }} className="fbt-grid">
          {/* Product rail (images with + separators) */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', overflowX: 'auto', paddingBottom: 12 }}>
            {allProducts.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 140 }}>
                  <div style={{ position: 'relative', width: 120, height: 150, borderRadius: 'var(--radius-card)', overflow: 'hidden', background: 'var(--paper2)', border: '1px solid var(--line)' }}>
                    <ProductImage src={p.image_url} alt={brandPlusName(p.brand, p.name)} width={120} height={150} />
                    <input
                      type="checkbox"
                      checked={Boolean(checked[p.id])}
                      onChange={e => setChecked(prev => ({ ...prev, [p.id]: e.target.checked }))}
                      style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, cursor: 'pointer' }}
                    />
                  </div>
                  <div style={{ textAlign: 'center', maxWidth: 160 }}>
                    <Overline style={{ color: 'var(--ink-500)', fontSize: '0.5625rem', display: 'block' }}>{p.brand}</Overline>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.3, marginTop: 2 }}>{p.name}</div>
                    <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--ink-700)', marginTop: 2 }}>
                      PKR {p.price.toLocaleString()}
                    </div>
                    {p.review_count != null && p.review_count > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center' }}>
                        <StarRating rating={p.rating} count={p.review_count} size={11} />
                      </div>
                    )}
                  </div>
                </label>
                {i < allProducts.length - 1 && (
                  <span style={{ fontSize: '1.5rem', color: 'var(--ink-300)', flexShrink: 0 }}>+</span>
                )}
              </div>
            ))}
          </div>

          {/* Summary + CTA */}
          <div style={{ padding: 24, background: 'var(--paper2)', borderRadius: 'var(--radius-card)', border: '1px solid var(--line)' }}>
            <div style={{ marginBottom: 12, fontSize: '0.8125rem', color: 'var(--ink-500)' }}>
              {Object.values(checked).filter(Boolean).length} item{Object.values(checked).filter(Boolean).length === 1 ? '' : 's'} selected
            </div>
            <div className="tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 16 }}>
              PKR {total.toLocaleString()}
            </div>
            <button
              onClick={handleAddAll}
              disabled={Object.values(checked).every(v => !v)}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              Add selected to cart
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
