'use client';

import { useState } from 'react';
import { Overline } from './Overline';
import type { Product } from '@/types';

interface ProductTileProps {
  product: Product;
  onClick?: () => void;
}

export function ProductTile({ product, onClick }: ProductTileProps) {
  const [hovered, setHovered] = useState(false);
  const { brand, name, variant, price, original_price } = product;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform 180ms ease-out',
      }}
    >
      <div className="img-placeholder" style={{
        width: '100%', aspectRatio: '1', borderRadius: 'var(--radius-card)',
        marginBottom: 12, position: 'relative',
      }}>
        <span style={{ padding: 16 }}>product photo</span>
        {original_price && (
          <span style={{
            position: 'absolute', top: 8, left: 8,
            background: 'var(--brand-yellow)', color: 'var(--ink-900)',
            padding: '2px 8px', borderRadius: 'var(--radius-pill)',
            fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>Sale</span>
        )}
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
