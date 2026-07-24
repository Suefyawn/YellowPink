'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProductImage } from '@/components/ui/ProductImage';
import { Overline } from '@/components/ui/Overline';
import { brandPlusName } from '@/lib/product-display';
import { useCart } from '@/context/CartContext';
import { RETURNS_WINDOW_DAYS } from '@/lib/commerce';
import { track } from '@/lib/analytics';
import type { Product } from '@/types';

// Compact "shop the products in this guide" card, injected high in a blog post
// (right after the intro). The blog is the store's biggest entry surface
// (~47% of sessions) and most of those visits bounce without ever reaching a
// PDP — so this card doesn't just link the product, it sells it in place:
// one-tap Add to Cart (simple, in-stock products) and the COD/returns promise
// right on the card. Client component for the cart hook; everything else
// renders in the SSR HTML as before.
export function BlogProductNudge({ products, label = 'Recommended in this guide' }: { products: Product[]; label?: string }) {
  const { addToCart } = useCart();
  const router = useRouter();
  const [addedId, setAddedId] = useState<string | null>(null);
  // Only pitch what a reader can actually buy right now.
  const picks = products
    .filter(p => !(p.track_inventory !== false && typeof p.stock === 'number' && p.stock <= 0))
    .slice(0, 2);
  if (picks.length === 0) return null;

  const handleAdd = (p: Product) => {
    // Variable products need a shade/size choice — send those to the PDP.
    if (p.kind === 'variable') {
      router.push(`/product/${p.slug}`);
      return;
    }
    if (addToCart({ ...p, qty: 1 })) {
      setAddedId(p.id);
      window.setTimeout(() => setAddedId(null), 1400);
    }
  };

  return (
    <aside
      style={{
        margin: '28px 0', padding: '16px 18px',
        background: 'var(--paper2, #faf6ee)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--brand-pink-text)' }}>
        {label}
      </Overline>
      <div style={{ display: 'grid', gridTemplateColumns: picks.length > 1 ? 'repeat(2, 1fr)' : '1fr', gap: 12 }} className="blog-nudge-grid">
        {picks.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link
              href={`/product/${p.slug}`}
              onClick={() => track({ name: 'select_item', payload: { product_id: p.id, product_name: p.name, list: 'Blog Nudge' } })}
              style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}
            >
              <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: '#fff', border: '1px solid var(--line)' }}>
                <ProductImage src={p.image_url} alt={brandPlusName(p.brand, p.name)} sizes="64px" />
              </div>
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-900)', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {brandPlusName(p.brand, p.name)}
                </span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--ink-700)' }}>
                  <span style={{ fontWeight: 600 }}>PKR {p.price.toLocaleString()}</span>
                  {(p.original_price ?? 0) > p.price && (
                    <span style={{ marginLeft: 6, textDecoration: 'line-through', color: 'var(--ink-500)', fontSize: '0.75rem' }}>
                      PKR {(p.original_price ?? 0).toLocaleString()}
                    </span>
                  )}
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => handleAdd(p)}
              aria-label={p.kind === 'variable' ? `Choose options for ${p.name}` : `Add ${p.name} to cart`}
              style={{
                flexShrink: 0, minHeight: 40, padding: '8px 12px',
                background: addedId === p.id ? 'var(--brand-pink-cta, #C5286A)' : 'transparent',
                color: addedId === p.id ? '#fff' : 'var(--brand-pink-cta, #C5286A)',
                border: '1px solid var(--brand-pink-cta, #C5286A)', borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-ui)', fontSize: '0.6875rem', fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
                whiteSpace: 'nowrap', transition: 'background 200ms, color 200ms',
              }}
            >
              {addedId === p.id ? 'Added ✓' : p.kind === 'variable' ? 'Options' : 'Add'}
            </button>
          </div>
        ))}
      </div>
      <p className="small-text" style={{ margin: '12px 0 0', color: 'var(--ink-700)', fontSize: '0.75rem' }}>
        Cash on delivery nationwide · {RETURNS_WINDOW_DAYS}-day returns on unopened items
      </p>
    </aside>
  );
}
