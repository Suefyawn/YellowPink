'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Overline } from '@/components/ui/Overline';

const CATS = [
  { label: 'Foundations',  href: '/shop?category=Foundations',  img: 'https://images.unsplash.com/photo-tvLvkRMNl70?w=400&auto=format&fit=crop&q=80' },
  { label: 'Lip Tints',    href: '/shop?category=Lip Tints',    img: 'https://images.unsplash.com/photo-NSgRPS2oOGI?w=400&auto=format&fit=crop&q=80' },
  { label: 'Concealers',   href: '/shop?category=Concealers',   img: 'https://images.unsplash.com/photo-ooPx1bxmTc4?w=400&auto=format&fit=crop&q=80' },
  { label: 'Skincare',     href: '/shop?category=Skincare',     img: 'https://images.unsplash.com/photo-g6q3lFAe3kA?w=400&auto=format&fit=crop&q=80' },
  { label: 'Sunscreen',    href: '/shop?category=Sunscreen',    img: 'https://images.unsplash.com/photo-9PnU-U7V6YE?w=400&auto=format&fit=crop&q=80' },
  { label: 'Blush',        href: '/shop?category=Blush',        img: 'https://images.unsplash.com/photo-xOEmZX6YSu8?w=400&auto=format&fit=crop&q=80' },
  { label: 'Highlighters', href: '/shop?category=Highlighters', img: 'https://images.unsplash.com/photo-A_ZiNBM1J5c?w=400&auto=format&fit=crop&q=80' },
  { label: 'Wellness',     href: '/shop?category=Wellness',     img: 'https://images.unsplash.com/photo-FDvArkoGyvI?w=400&auto=format&fit=crop&q=80' },
];

function CatTile({ label, href, img }: typeof CATS[0]) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ overflow: 'hidden', borderRadius: 'var(--radius-card)', position: 'relative', aspectRatio: '1' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img} alt={label}
          style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            transform: hovered ? 'scale(1.06)' : 'scale(1)',
            transition: 'transform 350ms ease-out',
          }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: hovered
            ? 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 100%)'
            : 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 60%)',
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
