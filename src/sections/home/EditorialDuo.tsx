'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { Overline } from '@/components/ui/Overline';

// Editorial duo: one makeup-led card and one wellness-led card, the two
// highest-demand PK themes (makeup 18k, supplements/ashwagandha/magnesium).
// Original generated banners served from /public (no remote host / demo-mode
// gap, and they're tiny ~48 KB webp so they don't weigh on the homepage).
const CARDS = [
  {
    title: 'Lips, Cheeks & Glow',
    subtitle: 'The Makeup Edit',
    cta: 'Shop Makeup',
    href: '/shop?taxon=makeup',
    img: '/editorial/makeup-edit.webp',
    fallbackColor: '#fbe9ef',
    alt: 'Imported makeup in Pakistan, lipstick, lip tints, blush, highlighter and brushes',
  },
  {
    title: 'Wellness & Supplements',
    subtitle: 'Beauty from Within',
    cta: 'Shop Supplements',
    href: '/shop?taxon=wellness',
    img: '/editorial/wellness-edit.webp',
    fallbackColor: '#eef3ec',
    alt: 'Health supplements and vitamins in Pakistan, multivitamins, ashwagandha, magnesium and omega-3',
  },
];

function DuoCard({ title, subtitle, cta, href, img, alt, fallbackColor }: typeof CARDS[0]) {
  const [hovered, setHovered] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
      >
        <div style={{ overflow: 'hidden', borderRadius: 'var(--radius-card)', aspectRatio: '4/3', position: 'relative' }}>
          {img && !imgFailed ? (
            <Image
              src={img} alt={alt}
              fill
              // Two-up grid below the hero, half-width on desktop, full on
              // phone (per the .duo-grid mobile rule in globals.css).
              sizes="(max-width: 900px) 100vw, 50vw"
              onError={() => setImgFailed(true)}
              style={{
                objectFit: 'cover',
                transform: hovered ? 'scale(1.04)' : 'scale(1)',
                transition: 'transform 400ms ease-out',
              }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${fallbackColor} 0%, ${fallbackColor}88 100%)` }} />
          )}
          <div aria-hidden="true" style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 60%)',
          }} />
        </div>
        <div style={{ marginTop: 16 }}>
          <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--ink-500)' }}>{subtitle}</Overline>
          <h2 className="display-l" style={{ fontSize: '2rem', marginBottom: 12 }}>{title}</h2>
          <span className="text-link">{cta}</span>
        </div>
      </div>
    </Link>
  );
}

export function EditorialDuo() {
  return (
    <section style={{ paddingBottom: 'var(--section-gap)' }}>
      <div className="container">
        <SectionDivider />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gutter)', marginTop: 'var(--section-gap)' }} className="duo-grid">
          {CARDS.map(c => <DuoCard key={c.title} {...c} />)}
        </div>
      </div>
    </section>
  );
}
