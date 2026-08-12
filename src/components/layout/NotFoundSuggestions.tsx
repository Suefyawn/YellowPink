'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Overline } from '@/components/ui/Overline';
import type { SuggestResponse } from '@/app/api/404/suggest/route';

// The recovery half of the 404 page. The page itself is static (see the note in
// src/app/not-found.tsx — a dynamic API in the root not-found boundary turns
// the whole site dynamic), so the missed path is only knowable on the client.
// This asks /api/404/suggest what the visitor was probably after and renders
// the answer above the generic fallback.
//
// Renders nothing at all until it has something real to show, so a genuine
// dead end (a scanner probing /wp-login.php) is not decorated with noise.

function formatPrice(n: number): string {
  return 'Rs ' + Math.round(n).toLocaleString('en-US');
}

export function NotFoundSuggestions() {
  const [data, setData] = useState<SuggestResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const path = window.location.pathname;
    fetch(`/api/404/suggest?path=${encodeURIComponent(path)}`, { signal: controller.signal })
      .then(r => (r.ok ? r.json() : null))
      .then((d: SuggestResponse | null) => {
        if (d && (d.products.length > 0 || d.brand || d.posts.length > 0)) setData(d);
      })
      .catch(() => { /* the generic fallback below is already on the page */ });
    return () => controller.abort();
  }, []);

  if (!data) return null;

  const { query, brand, products, posts } = data;

  return (
    <section style={{ padding: '0 0 40px' }}>
      <div className="container" style={{ maxWidth: 960 }}>
        <div
          style={{
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            background: 'var(--paper2)',
            padding: '24px 24px 28px',
          }}
        >
          <Overline style={{ display: 'block', marginBottom: 10, color: 'var(--ink-500)' }}>
            Were you looking for this?
          </Overline>

          {brand && (
            <p className="body-text" style={{ marginBottom: 16, color: 'var(--ink-900)' }}>
              We stock <Link href={`/brand/${brand.slug}`} className="text-link"><strong>{brand.name}</strong></Link>
              {' — '}
              <Link href={`/brand/${brand.slug}`} className="text-link">
                see all {brand.count} {brand.count === 1 ? 'product' : 'products'}
              </Link>.
            </p>
          )}

          {products.length > 0 && (
            <div
              className="product-grid"
              style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(products.length, 4)}, 1fr)`, gap: 'var(--gutter)' }}
            >
              {products.map(p => (
                <Link
                  key={p.slug}
                  href={`/product/${p.slug}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{
                    position: 'relative', width: '100%', aspectRatio: '1 / 1',
                    background: '#fff', borderRadius: 'var(--radius-card)',
                    border: '1px solid var(--line)', overflow: 'hidden', marginBottom: 8,
                  }}>
                    {p.imageUrl && (
                      <Image src={p.imageUrl} alt={p.name} fill sizes="(max-width: 768px) 45vw, 220px" style={{ objectFit: 'cover' }} />
                    )}
                  </div>
                  {p.brand && (
                    <span style={{ display: 'block', fontSize: '0.6875rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-500)' }}>
                      {p.brand}
                    </span>
                  )}
                  <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--ink-900)', margin: '2px 0 4px' }}>{p.name}</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-900)' }}>{formatPrice(p.price)}</span>
                  {p.originalPrice != null && p.originalPrice > p.price && (
                    <span style={{ marginLeft: 6, fontSize: '0.8125rem', color: 'var(--ink-500)', textDecoration: 'line-through' }}>
                      {formatPrice(p.originalPrice)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}

          {posts.length > 0 && (
            <div style={{ marginTop: products.length > 0 ? 20 : 0 }}>
              <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>
                From the journal
              </Overline>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {posts.map(post => (
                  <li key={post.slug} style={{ marginBottom: 4 }}>
                    <Link href={`/blog/${post.slug}`} className="text-link" style={{ fontSize: '0.875rem' }}>
                      {post.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {query && (
            <p style={{ marginTop: 18, marginBottom: 0, fontSize: '0.875rem', color: 'var(--ink-700)' }}>
              Not it?{' '}
              <Link href={`/shop?q=${encodeURIComponent(query)}`} className="text-link">
                Search the shop for &ldquo;{query}&rdquo;
              </Link>
              {' '}or{' '}
              <Link href="/go/whatsapp" className="text-link">ask us on WhatsApp</Link>.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
