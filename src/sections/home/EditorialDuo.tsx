'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { Overline } from '@/components/ui/Overline';

const CARDS = [
  {
    title: 'Treat Melasma',
    subtitle: 'Real Solutions',
    cta: 'Explore Treatments',
    href: '/shop?category=Skincare',
    img: 'https://images.unsplash.com/photo-ShuXkYOkDvs?w=700&auto=format&fit=crop&q=80',
    alt: 'Skincare cream and serum products',
  },
  {
    title: 'Clear Skin',
    subtitle: 'Acne Care',
    cta: 'Shop Cleansers',
    href: '/shop?category=Skincare',
    img: 'https://images.unsplash.com/photo-g6q3lFAe3kA?w=700&auto=format&fit=crop&q=80',
    alt: 'Skincare products on natural background',
  },
];

function DuoCard({ title, subtitle, cta, href, img, alt }: typeof CARDS[0]) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
      >
        <div style={{ overflow: 'hidden', borderRadius: 'var(--radius-card)', aspectRatio: '4/3', position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img}
            alt={alt}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              transform: hovered ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 400ms ease-out',
              display: 'block',
            }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 60%)',
          }} />
        </div>
        <div style={{ marginTop: 16 }}>
          <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--ink-500)' }}>{subtitle}</Overline>
          <h2 className="display-l" style={{ fontSize: '2rem', marginBottom: 12 }}>{title}</h2>
          <span className="btn-secondary">{cta}</span>
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
