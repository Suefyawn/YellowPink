'use client';

import { useState } from 'react';
import { Overline } from './Overline';
import { ProductImage } from './ProductImage';
import { useWishlist } from '@/context/WishlistContext';
import type { Product } from '@/types';

interface ProductTileProps {
  product: Product;
  onClick?: () => void;
}

export function ProductTile({ product, onClick }: ProductTileProps) {
  const [hovered, setHovered] = useState(false);
  const { toggle, isWishlisted } = useWishlist();
  const { id, brand, name, variant, price, original_price } = product;
  const wishlisted = isWishlisted(id);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'transform 220ms ease-out',
      }}
    >
      <div style={{
        width: '100%', aspectRatio: '1', borderRadius: 'var(--radius-card)',
        marginBottom: 12, position: 'relative', overflow: 'hidden',
        background: 'var(--paper2)',
        boxShadow: hovered
          ? '0 12px 28px rgba(26, 26, 26, 0.10), 0 2px 6px rgba(26, 26, 26, 0.04)'
          : '0 1px 2px rgba(26, 26, 26, 0.03)',
        transition: 'box-shadow 240ms ease-out',
      }}>
        <div style={{
          width: '100%', height: '100%',
          transform: hovered ? 'scale(1.035)' : 'scale(1)',
          transition: 'transform 500ms ease-out',
        }}>
          <ProductImage src={product.image_url} alt={`${brand} ${name}`} label={brand} />
        </div>
        {original_price && (
          <span style={{
            position: 'absolute', top: 8, left: 8,
            background: 'var(--brand-yellow)', color: 'var(--ink-900)',
            padding: '2px 8px', borderRadius: 'var(--radius-pill)',
            fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>Sale</span>
        )}
        <button
          onClick={e => { e.stopPropagation(); toggle(id); }}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 32, height: 32, borderRadius: '50%',
            background: wishlisted ? 'var(--brand-pink)' : 'rgba(255,255,255,0.9)',
            border: wishlisted ? 'none' : '1px solid rgba(0,0,0,0.08)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.875rem',
            transition: 'background 150ms, transform 150ms',
            transform: wishlisted ? 'scale(1.1)' : 'scale(1)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }}
        >
          <span style={{ color: wishlisted ? 'white' : 'var(--ink-500)', lineHeight: 1 }}>
            {wishlisted ? '♥' : '♡'}
          </span>
        </button>
      </div>
      <Overline style={{ color: 'var(--ink-500)', marginBottom: 2, display: 'block' }}>{brand}</Overline>
      <div className="h3" style={{ marginBottom: 2, position: 'relative', display: 'inline-block' }}>
        {name}
        <div style={{
          position: 'absolute', bottom: -1, left: 0, right: 0, height: 2,
          background: 'var(--brand-yellow)',
          transform: hovered ? 'scaleX(1)' : 'scaleX(0)',
          transformOrigin: 'left', transition: 'transform 180ms ease-out',
        }} />
      </div>
      {variant && <div className="small-text" style={{ marginBottom: 4, display: 'block' }}>{variant}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <span className="tabular-nums" style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
          PKR {price.toLocaleString()}
        </span>
        {original_price && (
          <span className="tabular-nums" style={{
            textDecoration: 'line-through', color: 'var(--brand-pink)', fontSize: '0.8125rem',
          }}>PKR {original_price.toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}
