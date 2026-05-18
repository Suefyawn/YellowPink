'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Overline } from '@/components/ui/Overline';

// Real product images from yellowpink.pk store
const CATS = [
  { label: 'Lip & Cheek Tints', href: '/shop?category=Makeup&subcategory=Lip+%26+Cheek+Tints', img: 'https://yellowpink.pk/wp-content/uploads/2025/02/pearly-peach-rose-2.webp',                                                            color: '#fce4ec' },
  { label: 'Highlighters',      href: '/shop?category=Makeup&subcategory=Highlighters',         img: 'https://yellowpink.pk/wp-content/uploads/2025/01/Iconic_Illuminator_Blush_Open_Pipette_0f8e3ca3-90ec-40b3-98a5-75120fb6cd93.jpg',     color: '#fffde7' },
  { label: 'Concealers',        href: '/shop?category=Makeup&subcategory=Concealers',           img: 'https://yellowpink.pk/wp-content/uploads/2025/02/2090-shape-tape-ultra-creamy-concealer-12N-scaled.jpg',                               color: '#fdf6e3' },
  { label: 'Contour',           href: '/shop?category=Makeup&subcategory=Contour+Sticks',       img: 'https://yellowpink.pk/wp-content/uploads/2025/01/NARS-Mont-Blanc.png',                                                                 color: '#f5e6d3' },
  { label: 'Skincare',          href: '/shop?category=Skincare',                                img: 'https://yellowpink.pk/wp-content/uploads/2025/01/anti-melasma-cream-2.webp',                                                           color: '#e8f5e9' },
  { label: 'Moisturizers',      href: '/shop?category=Skincare&subcategory=Moisturizers',       img: 'https://yellowpink.pk/wp-content/uploads/2025/01/barubt-tinted-moisturizer-and-sunscreen.webp',                                        color: '#fff8e1' },
  { label: 'Wellness',          href: '/shop?category=Wellness',                                img: 'https://yellowpink.pk/wp-content/uploads/2026/01/Untitled-1-08.webp',                                                                  color: '#e8f5e9' },
  { label: 'Skin Makeup',       href: '/shop?category=Makeup&subcategory=Skin+Makeup',          img: 'https://yellowpink.pk/wp-content/uploads/2025/01/birthday-suit-sheglam.jpg',                                                           color: '#fce4ec' },
];

function CatTile({ label, href, img, color }: typeof CATS[0]) {
  const [hovered, setHovered] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ overflow: 'hidden', borderRadius: 'var(--radius-card)', position: 'relative', aspectRatio: '1' }}
      >
        {!imgFailed ? (
          <Image
            src={img} alt={label}
            fill
            // 4-up grid on desktop ≈ 25vw; 2-up on tablet ≈ 50vw;
            // 1-up below 600 ≈ 100vw (per .cat-grid in globals.css).
            sizes="(max-width: 600px) 50vw, (max-width: 900px) 50vw, 25vw"
            onError={() => setImgFailed(true)}
            style={{
              objectFit: 'cover',
              transform: hovered ? 'scale(1.06)' : 'scale(1)',
              transition: 'transform 350ms ease-out',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: `linear-gradient(135deg, ${color} 0%, ${color}88 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Overline style={{ color: '#374151', fontSize: '0.75rem', textAlign: 'center' }}>{label}</Overline>
          </div>
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: hovered
            ? 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 100%)'
            : 'linear-gradient(to top, rgba(0,0,0,0.38) 0%, transparent 55%)',
          transition: 'background 300ms ease-out',
          display: 'flex', alignItems: 'flex-end', padding: 12,
        }}>
          <Overline style={{ color: '#fff', fontSize: '0.625rem' }}>{label}</Overline>
        </div>
      </div>
    </Link>
  );
}

export function CategoryTiles() {
  return (
    <section style={{ padding: 'var(--section-gap) 0' }}>
      <div className="container">
        <Overline style={{ display: 'block', marginBottom: 32 }}>Shop by Category</Overline>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }} className="cat-grid">
          {CATS.map(c => <CatTile key={c.label} {...c} />)}
        </div>
      </div>
    </section>
  );
}
