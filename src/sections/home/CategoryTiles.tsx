'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Overline } from '@/components/ui/Overline';

// Each tile links to the real `category` value on `products` so the Shop
// page filter actually matches rows. The earlier links used
// `?category=Makeup` (no product had that value) — the page rendered an
// empty grid. We use the live category names like "Lip & Cheek Tints"
// instead, which match exactly.
const CATS = [
  { label: 'Lip & Cheek Tints', href: '/shop?category=' + encodeURIComponent('Lip & Cheek Tints'),  img: 'https://yellowpink.pk/wp-content/uploads/2025/02/pearly-peach-rose-2.webp',                                                            color: '#fce4ec' },
  { label: 'Highlighters',      href: '/shop?category=Highlighters',                                 img: 'https://yellowpink.pk/wp-content/uploads/2025/01/Iconic_Illuminator_Blush_Open_Pipette_0f8e3ca3-90ec-40b3-98a5-75120fb6cd93.jpg',     color: '#fffde7' },
  { label: 'Skincare',          href: '/shop?category=Skincare',                                     img: 'https://yellowpink.pk/wp-content/uploads/2025/01/anti-melasma-cream-2.webp',                                                           color: '#e8f5e9' },
  { label: 'Moisturizers',      href: '/shop?category=Moisturizers',                                 img: 'https://yellowpink.pk/wp-content/uploads/2025/01/barubt-tinted-moisturizer-and-sunscreen.webp',                                        color: '#fff8e1' },
  { label: 'Brushes',           href: '/shop?category=Brushes',                                      img: 'https://yellowpink.pk/wp-content/uploads/2025/01/NARS-Mont-Blanc.png',                                                                 color: '#f5e6d3' },
  { label: 'Skin Makeup',       href: '/shop?category=' + encodeURIComponent('Skin Makeup'),         img: 'https://yellowpink.pk/wp-content/uploads/2025/01/birthday-suit-sheglam.jpg',                                                           color: '#fce4ec' },
  { label: 'Wellness',          href: '/shop?taxon=wellness',                                        img: 'https://yellowpink.pk/wp-content/uploads/2026/01/Untitled-1-08.webp',                                                                  color: '#e8f5e9' },
  { label: 'Bundles',           href: '/shop?taxon=bundles',                                         img: 'https://yellowpink.pk/wp-content/uploads/2025/02/pearly-peach-rose-2.webp',                                                            color: '#fdf6e3' },
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
          /* Stronger floor on the gradient so the label stays readable
             over a light-image tile (e.g. the pearly-peach Lip+Cheek
             thumbnail). At 0.42 the contrast dropped to ~2.4:1 on the
             lightest images; 0.62 lifts it past 4.5:1 with white text. */
          background: hovered
            ? 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.12) 100%)'
            : 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, transparent 55%)',
          transition: 'background 300ms ease-out',
          display: 'flex', alignItems: 'flex-end', padding: 14,
        }}>
          {/* Label is the primary CTA of the tile — bump the overline to
              13px (was 10px) so it's legible at a glance and reads as a
              clickable tag, not a fine-print caption. */}
          <Overline style={{ color: '#fff', fontSize: '0.8125rem', letterSpacing: '0.12em' }}>{label}</Overline>
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
