import Link from 'next/link';
import type { Metadata } from 'next';

// Force dynamic so prerender doesn't choke on the useSearchParams() inside
// the PostHogProvider that the root layout renders. The cost is one extra
// SSR per 404 hit which is negligible (404s are rare and uncacheable
// anyway). This used to be implicit when the layout exported
// force-dynamic, restored explicitly when the layout opt-out shipped.
export const dynamic = 'force-dynamic';
import { after } from 'next/server';
import { headers } from 'next/headers';
import { LogoMark } from '@/components/ui/LogoMark';
import { Overline } from '@/components/ui/Overline';
import { getProducts } from '@/lib/supabase';
import { logNotFound } from '@/lib/not-found-log';
import { ProductTile } from '@/components/ui/ProductTile';

// noindex this page, we never want the SERP to think 404 is a destination.
// Next surfaces the proper 404 HTTP status automatically for this route.
export const metadata: Metadata = {
  title: 'Page not found',
  description:
    'The page you are looking for could not be found. Browse our latest beauty, skincare and wellness products.',
  robots: { index: false, follow: true },
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
  // Record the miss for the 404 monitor. The requested path is carried on the
  // `x-pathname` header set by the middleware (src/proxy.ts); not-found.tsx
  // itself can't otherwise see which URL 404'd. Runs in after() so it never
  // adds latency to (or can break) the 404 render. Prefetch requests are
  // skipped, the router speculatively prefetches links, which aren't real
  // dead-ends.
  const h = await headers();
  after(() =>
    logNotFound({
      path: h.get('x-pathname'),
      referer: h.get('referer'),
      userAgent: h.get('user-agent'),
      isPrefetch:
        h.get('next-router-prefetch') === '1' ||
        h.get('purpose') === 'prefetch' ||
        h.get('x-middleware-prefetch') === '1',
    }),
  );

  // Light recovery surface, show a handful of products so a misdirected
  // visitor lands on something useful instead of a dead-end.
  const products = (await getProducts().catch(() => [])).slice(0, 4);

  return (
    <main>
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
