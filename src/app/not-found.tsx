import Link from 'next/link';
import type { Metadata } from 'next';

// IMPORTANT: keep this file static. The root not-found boundary is part of
// every route's render tree, so any dynamic API here (headers()/cookies() or
// `export const dynamic = 'force-dynamic'`) poisons the WHOLE site into dynamic
// rendering — which killed the static/ISR edge cache and pushed TTFB to ~1.5s.
// The missed path is now reported by the <NotFoundBeacon/> client component to
// /api/404 (server-side logging + bot detection still happen there).
import { LogoMark } from '@/components/ui/LogoMark';
import { Overline } from '@/components/ui/Overline';
import { getProducts } from '@/lib/supabase';
import { NotFoundBeacon } from '@/components/layout/NotFoundBeacon';
import { ProductTile } from '@/components/ui/ProductTile';

// No robots directive here: Next already injects <meta name="robots"
// content="noindex"> automatically on not-found renders, and declaring our
// own produced TWO robots metas on every 404 — a latent footgun if the two
// ever disagree. The framework's noindex is sufficient.
export const metadata: Metadata = {
  title: 'Page not found',
  description:
    'The page you are looking for could not be found. Browse our latest beauty, skincare and wellness products.',
};

const POPULAR_LINKS = [
  { label: 'Makeup',     href: '/shop?taxon=makeup' },
  { label: 'Skincare',   href: '/shop?taxon=skincare' },
  { label: 'Wellness',   href: '/shop?taxon=wellness' },
  { label: 'Bestsellers', href: '/shop?bestseller=1' },
  { label: 'New In',     href: '/shop' },
  { label: 'Blog',       href: '/blog' },
];

export default async function NotFound() {
  // Light recovery surface, show a handful of products so a misdirected
  // visitor lands on something useful instead of a dead-end. getProducts is
  // build-time data here (this page is static), so it adds no per-request cost.
  const products = (await getProducts().catch(() => [])).slice(0, 4);

  return (
    <main>
      {/* Report the missed path to /api/404 (server-side logging lives there,
          off the static render path). */}
      <NotFoundBeacon />
      <section style={{ padding: '80px 0 48px', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 640 }}>
          <div style={{ marginBottom: 24, display: 'inline-flex' }}>
            <LogoMark size={48} />
          </div>
          <Overline style={{ display: 'block', marginBottom: 16, color: 'var(--ink-500)' }}>
            Error 404
          </Overline>
          <h1
            style={{
              fontFamily: 'var(--font-display)', fontSize: '5.5rem', fontWeight: 500,
              letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 12, color: 'var(--ink-900)',
            }}
          >
            Lost in the aisles
          </h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 28, maxWidth: 480, margin: '0 auto 28px' }}>
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
            Try one of the popular destinations below, or jump straight back to the shop.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
            <Link href="/" className="btn-primary">Go Home</Link>
            <Link href="/shop" className="btn-secondary">Browse Shop</Link>
          </div>

          <div
            style={{
              display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap',
              paddingTop: 24, borderTop: '1px solid var(--line)',
            }}
            aria-label="Popular destinations"
          >
            {POPULAR_LINKS.map(l => (
              <Link
                key={l.label}
                href={l.href}
                style={{
                  display: 'inline-flex',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--paper2)',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: 'var(--ink-900)',
                  textDecoration: 'none',
                  transition: 'background 150ms',
                }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {products.length > 0 && (
        <section style={{ padding: '0 0 var(--section-gap)' }}>
          <div className="container">
            <Overline style={{ display: 'block', marginBottom: 24, color: 'var(--ink-500)' }}>
              Or pick up where you left off
            </Overline>
            <div
              className="product-grid"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }}
            >
              {products.map(p => (
                <ProductTile key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
