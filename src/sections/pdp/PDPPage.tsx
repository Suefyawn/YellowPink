'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import { useCart } from '@/context/CartContext';
import type { Product } from '@/types';

const SHIPPING_CONTENT = 'Free shipping on orders over PKR 2,500. COD available nationwide. 7-day return policy on unopened items.';

const PAIRS_WITH: Product[] = [
  { id: 'pair-1', brand: 'Pixi', name: 'On-the-Glow Blush', variant: 'Fleur', price: 3400, category: 'Blush', slug: 'pixi-on-the-glow-blush-stick', stock: 10 },
  { id: 'pair-2', brand: 'SHEGLAM', name: 'Color Bloom Blush', variant: 'Risky Business', price: 1200, category: 'Blush', slug: 'sheglam-color-bloom-liquid-blush-risky-business', stock: 10 },
  { id: 'pair-3', brand: 'Iconic London', name: 'Liquid Highlighter', variant: 'Original', price: 4800, category: 'Makeup', slug: 'iconic-london-liquid-highlighter', stock: 10 },
  { id: 'pair-4', brand: 'CeraVe', name: 'Moisturizing Cream', variant: '340g', price: 3900, category: 'Skincare', slug: 'cerave-moisturizing-cream', stock: 10 },
];

export function PDPPage({ product }: { product: Product }) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [addedFlash, setAddedFlash] = useState(false);
  const { addToCart } = useCart();

  const handleAdd = () => {
    setAddedFlash(true);
    addToCart({ ...product, qty });
    setTimeout(() => setAddedFlash(false), 400);
  };

  return (
    <div>
      <div className="container" style={{ padding: '16px var(--side)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', color: 'var(--ink-500)', textDecoration: 'none' }}>Home</Link>
          <span style={{ color: 'var(--ink-500)', fontSize: '0.75rem' }}>/</span>
          <Link href="/shop" style={{ fontSize: '0.8125rem', color: 'var(--ink-500)', textDecoration: 'none' }}>{product.brand}</Link>
          <span style={{ color: 'var(--ink-500)', fontSize: '0.75rem' }}>/</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--ink-900)' }}>{product.name}</span>
        </div>
      </div>

      <div className="container" style={{ borderTop: '1px solid var(--line)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, padding: '40px 0' }} className="pdp-grid">
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
              {[0, 1, 2, 3].map(idx => (
                <div key={idx} onClick={() => setSelectedImage(idx)}
                  className="img-placeholder" style={{
                    width: 56, height: 56, borderRadius: 'var(--radius-card)', cursor: 'pointer',
                    border: selectedImage === idx ? '2px solid var(--ink-900)' : '2px solid var(--line)',
                    fontSize: '0.5rem', transition: 'border-color 150ms',
                  }}>{idx + 1}</div>
              ))}
            </div>
            <div className="img-placeholder" style={{ flex: 1, aspectRatio: '4/5', borderRadius: 'var(--radius-card)' }}>
              <span>product image {selectedImage + 1}</span>
            </div>
          </div>

          <div>
            <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>{product.brand}</Overline>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 500,
              letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: 8,
            }}>{product.name}</h1>
            {product.variant && (
              <div className="body-text" style={{ color: 'var(--ink-500)', marginBottom: 16 }}>{product.variant}</div>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
              <span className="tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 600 }}>PKR {product.price.toLocaleString()}</span>
              {product.original_price && (
                <span className="tabular-nums" style={{ textDecoration: 'line-through', color: 'var(--brand-pink)', fontSize: '1rem' }}>
                  PKR {product.original_price.toLocaleString()}
                </span>
              )}
            </div>
            <div style={{ marginBottom: 20 }}>
              {product.stock === 0 ? (
                <span style={{ display: 'inline-block', padding: '3px 10px', background: '#fef2f2', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, color: '#dc2626' }}>Out of Stock</span>
              ) : product.stock <= 5 ? (
                <span style={{ display: 'inline-block', padding: '3px 10px', background: '#fffbeb', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, color: '#d97706' }}>Only {product.stock} left</span>
              ) : (
                <span style={{ display: 'inline-block', padding: '3px 10px', background: '#f0fdf4', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, color: '#16a34a' }}>In Stock</span>
              )}
            </div>
            <hr className="hairline" style={{ marginBottom: 24 }} />
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)' }}>
                <button onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 40, height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--ink-700)' }}>−</button>
                <span style={{ width: 32, textAlign: 'center', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{qty}</span>
                <button onClick={() => setQty(qty + 1)} style={{ width: 40, height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--ink-700)' }}>+</button>
              </div>
              <button onClick={handleAdd} disabled={product.stock === 0} className="btn-primary" style={{
                flex: 1,
                background: product.stock === 0 ? '#d1d5db' : addedFlash ? 'var(--brand-yellow)' : 'var(--brand-pink)',
                transition: 'background 100ms ease-out',
                cursor: product.stock === 0 ? 'not-allowed' : 'pointer',
              }}>
                {product.stock === 0 ? 'Out of Stock' : addedFlash ? 'Added ✓' : 'Add to Cart'}
              </button>
            </div>
            {product.description && (
              <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 24, maxWidth: 440 }}>
                {product.description}
              </p>
            )}
            <hr className="hairline" style={{ marginBottom: 0 }} />
            {([
              product.how_to_use ? { key: 'use', title: 'How to Use', content: product.how_to_use } : null,
              product.ingredients ? { key: 'ingredients', title: 'Ingredients', content: product.ingredients } : null,
              { key: 'shipping', title: 'Shipping & Returns', content: SHIPPING_CONTENT },
            ] as Array<{ key: string; title: string; content: string } | null>)
              .filter(Boolean)
              .map(sec => sec && (
              <div key={sec.key} style={{ borderBottom: '1px solid var(--line)' }}>
                <button onClick={() => setExpandedSection(expandedSection === sec.key ? null : sec.key)} style={{
                  width: '100%', padding: '16px 0', background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontFamily: 'var(--font-ui)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-900)',
                }}>
                  {sec.title}
                  <span style={{ transform: expandedSection === sec.key ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms ease-out', fontSize: '0.75rem' }}>▼</span>
                </button>
                {expandedSection === sec.key && (
                  <div className="body-text" style={{ color: 'var(--ink-700)', paddingBottom: 16 }}>{sec.content}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <section style={{ background: 'var(--paper2)', padding: 'var(--section-gap) 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container story-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          <div className="img-placeholder" style={{ aspectRatio: '4/3', borderRadius: 'var(--radius-card)' }}>
            <span>editorial lifestyle photo</span>
          </div>
          <div>
            <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>The Story</Overline>
            <h2 className="display-l" style={{ fontSize: '2rem', marginBottom: 16 }}>Why {product.name}?</h2>
            <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 16, maxWidth: 440 }}>
              Every product we carry has been tested, reviewed, and chosen for Pakistani skin tones and climates. We don&apos;t carry what doesn&apos;t work.
            </p>
            <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 440 }}>
              Imported directly from authorized distributors. No fakes, no compromises.
            </p>
          </div>
        </div>
      </section>

      <section style={{ padding: 'var(--section-gap) 0' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 32 }}>Pairs With</Overline>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }} className="product-grid">
            {PAIRS_WITH.map((p) => (
              <Link key={p.id} href={`/product/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <ProductTile product={p} />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
