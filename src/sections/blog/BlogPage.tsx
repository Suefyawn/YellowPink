'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import type { BlogPost } from '@/types';

const FILTERS = ['All', 'Skincare', 'Makeup', 'Wellness'];

export function BlogPage({ posts }: { posts: BlogPost[] }) {
  const [activeFilter, setActiveFilter] = useState('All');
  const featured = posts.find(p => p.featured);
  const filtered = activeFilter === 'All' ? posts : posts.filter(p => p.category === activeFilter);

  return (
    <div>
      <section style={{ padding: '48px 0', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Journal</Overline>
          <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>The Edit</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 480 }}>
            Expert guides, honest reviews, and the science behind beauty and health — no fluff.
          </p>
        </div>
      </section>

      {featured && (
        <section style={{ padding: 'var(--section-gap) 0', borderBottom: '1px solid var(--line)' }}>
          <div className="container">
            <Link href={`/blog/${featured.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 48, alignItems: 'center', cursor: 'pointer' }} className="duo-grid">
                <div style={{ aspectRatio: '16/10', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
                  <ProductImage src={featured.image_url} alt={featured.title} priority sizes="(max-width: 900px) 100vw, 60vw" />
                </div>
                <div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ padding: '3px 10px', background: 'var(--brand-yellow)', borderRadius: 'var(--radius-pill)', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Featured</span>
                    <Overline style={{ color: 'var(--ink-500)' }}>{featured.category}</Overline>
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 12 }}>{featured.title}</h2>
                  <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 16 }}>{featured.excerpt}</p>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span className="small-text">{featured.date}</span>
                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-500)' }} />
                    <span className="small-text">{featured.read_time}</span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      <section style={{ padding: 'var(--section-gap) 0' }}>
        <div className="container">
          <div style={{ display: 'flex', gap: 12, marginBottom: 40 }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => setActiveFilter(f)} style={{
                padding: '8px 16px', borderRadius: 'var(--radius-pill)',
                border: '1px solid ' + (activeFilter === f ? 'var(--ink-900)' : 'var(--line)'),
                background: activeFilter === f ? 'var(--ink-900)' : 'transparent',
                color: activeFilter === f ? 'var(--paper)' : 'var(--ink-700)',
                fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 500,
                cursor: 'pointer', transition: 'all 150ms ease-out',
              }}>{f}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }} className="blog-grid">
            {filtered.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <article style={{ cursor: 'pointer' }}>
                  <div style={{ aspectRatio: '16/10', borderRadius: 'var(--radius-card)', overflow: 'hidden', marginBottom: 16, transition: 'transform 200ms ease-out' }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <ProductImage src={post.image_url} alt={post.title} sizes="(max-width: 700px) 100vw, 33vw" />
                  </div>
                  <Overline style={{ color: 'var(--ink-500)', display: 'block', marginBottom: 6 }}>{post.category}</Overline>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.3, marginBottom: 8 }}>{post.title}</h3>
                  <p className="small-text" style={{ marginBottom: 8, lineHeight: 1.5 }}>{post.excerpt}</p>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span className="small-text" style={{ fontSize: '0.75rem' }}>{post.date}</span>
                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-500)' }} />
                    <span className="small-text" style={{ fontSize: '0.75rem' }}>{post.read_time}</span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
