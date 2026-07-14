// Leaf-category landing pages at clean path URLs (/category/hair-care).
//
// These replace the /shop?category= parameter pages as the canonical category
// URLs. Two audit findings motivated the move: the parameter pages were fully
// dynamic (cache-control: no-store, TTFB 1.4–1.9s for Googlebot on the site's
// highest-priority commercial URLs) because reading searchParams opts a route
// out of ISR; and the rendered /shop HTML contained no crawlable <a> to any
// category URL, so they were nearly orphaned internally. Path routes prerender
// via generateStaticParams + ISR (5-min, same as PDPs) and take real links
// from the homepage grid, breadcrumbs and nav.
//
// NO loading.tsx in this segment, deliberately: a loading boundary makes Next
// stream a 200 shell before the slug resolves, turning unknown slugs into
// soft-404s (see the tag/brand routes' history).
export const revalidate = 300;

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import { getProducts, supabase, isDemo } from '@/lib/supabase';
import { CollectionGrid } from '@/sections/collection/CollectionGrid';
import { ProductTile } from '@/components/ui/ProductTile';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Overline } from '@/components/ui/Overline';
import { pageMeta, jsonLd, breadcrumbLd, itemListLd, productInStock } from '@/lib/seo';
import {
  ALL_CATEGORIES, CATEGORY_DESCRIPTIONS, CATEGORY_INTRO,
  canonicalCategory, categorySlug, findTaxon, taxonForCategory, isHealthCategory,
} from '@/lib/category-taxonomy';
import { redirectIfMapped } from '@/lib/redirects';
import { getDefaultEstimatedDays } from '@/lib/shipping';
import { RETURNS_WINDOW_DAYS } from '@/lib/commerce';
import type { Product } from '@/types';

// Pre-render every leaf category at build; the taxonomy is code, so the set
// is closed and small (~20 pages).
export function generateStaticParams() {
  return ALL_CATEGORIES.map(c => ({ slug: categorySlug(c) }));
}

// Resolve a /category/<slug> segment. Returns the canonical label for a leaf
// category; taxon slugs and unknown values are redirected by the caller.
function resolveLeaf(slug: string): string | null {
  const label = canonicalCategory(slug);
  if (!label) return null;
  // canonicalCategory maps taxon inputs to the taxon LABEL — those live at
  // /shop?taxon=, not here.
  return findTaxon(label) ? null : label;
}

// Unknown slug handling, shared by metadata + body (metadata resolves first
// at runtime — anything thrown only in the body lands after the 200 status
// is committed). A taxon slug goes to its real landing page; anything else
// (typically a legacy WordPress blog-category URL) honours a manual redirect
// mapping first, then falls through to shop search on the slug's words —
// the same successor-page pattern the tag route uses.
async function redirectAway(slug: string): Promise<never> {
  const taxon = findTaxon(slug);
  if (taxon) permanentRedirect(`/shop?taxon=${taxon.key}`);
  await redirectIfMapped(`/category/${slug}`);
  permanentRedirect(`/shop?q=${encodeURIComponent(slug.replace(/-/g, ' '))}`);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const label = resolveLeaf(slug);
  if (!label) await redirectAway(slug);
  const description = CATEGORY_DESCRIPTIONS[label!]
    ?? `Shop ${label} at Yellow Pink — 100% authentic, imported, with cash on delivery across Pakistan.`;
  // One representative packshot for the social card.
  const products = await getProducts();
  const cover = products.find(p => p.category === label && p.image_url)?.image_url ?? undefined;
  return pageMeta({
    title: `Shop ${label} in Pakistan`,
    description,
    path: `/category/${slug}`,
    image: cover,
  });
}

// Category-landing FAQ: same store-fact set the /shop landings render —
// visible copy only, no FAQPage JSON-LD (ineligible for stores since 2023).
function landingFaqs(label: string, estimatedDays?: { min: number; max: number } | null): { q: string; a: string }[] {
  const c = label.toLowerCase();
  const deliveryRange = estimatedDays ? `${estimatedDays.min}–${estimatedDays.max}` : 'a few';
  return [
    { q: `Are your ${c} products authentic?`,
      a: `Yes, every ${c} product at Yellow Pink is 100% genuine, sourced from authorised channels and imported for the Pakistani market. We never sell counterfeits.` },
    { q: `Is cash on delivery (COD) available for ${c}?`,
      a: `Absolutely. You can order any ${c} product with cash on delivery nationwide across Pakistan, and pay only when your parcel arrives.` },
    { q: `How long does delivery take?`,
      a: `Orders are typically delivered in ${deliveryRange} working days, with tracking shared on WhatsApp once your order ships.` },
    { q: `Can I return ${c} products?`,
      a: `Yes, unused items can be returned within ${RETURNS_WINDOW_DAYS} days of delivery. Start a return from your account or message us on WhatsApp and we'll help.` },
  ];
}

export default async function CategoryLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const label = resolveLeaf(slug);
  // Kept in sync with generateMetadata (which resolves first at runtime).
  if (!label) await redirectAway(slug);

  const [products, estimatedDays] = await Promise.all([getProducts(), getDefaultEstimatedDays()]);
  const list = products.filter(p => p.category === label);
  const taxon = taxonForCategory(label);

  // Buyer guides for health categories: internal links from this
  // heavily-crawled landing down to the supplement guides (mirrors /shop).
  let guides: { slug: string; title: string }[] = [];
  if (!isDemo && isHealthCategory(label)) {
    const { data: guideRows } = await supabase
      .from('blog_posts')
      .select('slug, title, category')
      .order('date', { ascending: false })
      .limit(60);
    guides = ((guideRows ?? []) as Array<{ slug: string; title: string; category: string | null }>)
      .filter(g => isHealthCategory(g.category))
      .slice(0, 4)
      .map(g => ({ slug: g.slug, title: g.title }));
  }

  const breadcrumb = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    ...(taxon ? [{ name: taxon.label, path: `/shop?taxon=${taxon.key}` }] : []),
    { name: label!, path: `/category/${slug}` },
  ];
  const intro = CATEGORY_INTRO[label!] ?? CATEGORY_DESCRIPTIONS[label!] ?? null;
  const faqs = landingFaqs(label!, estimatedDays);

  return (
    <main className="fade-in">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd(breadcrumb)) }} />
      {list.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(itemListLd(`${label} products`, list.slice(0, 24).map((p: Product) => ({
              name: p.name, path: `/product/${p.slug}`, image: p.image_url,
              brand: p.brand, price: p.price, inStock: productInStock(p),
            })))),
          }}
        />
      )}
      <Breadcrumbs items={breadcrumb} />

      <section style={{ padding: '48px 0 0', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>
            {taxon ? taxon.label : 'Shop'}
          </Overline>
          <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>{label}</h1>
          {intro && (
            <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 720, marginBottom: 24 }}>{intro}</p>
          )}
        </div>
      </section>

      <section style={{ padding: 'var(--section-gap) 0' }}>
        <div className="container">
          {list.length > 0 ? (
            // CollectionGrid reads useSearchParams (sort/page), which forces a
            // CSR bailout during the static prerender — without a Suspense
            // boundary the build fails outright ("missing-suspense-with-
            // csr-bailout", found on the first Vercel build of this route).
            // The fallback is a real server-rendered grid of the same
            // products, so the prerendered HTML crawlers index still carries
            // every tile; hydration swaps in the interactive toolbar.
            <Suspense
              fallback={
                <div className="product-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }}>
                  {list.slice(0, 24).map(p => <ProductTile key={p.id} product={p} />)}
                </div>
              }
            >
              <CollectionGrid products={list} basePath={`/category/${slug}`} />
            </Suspense>
          ) : (
            <p className="body-text" style={{ color: 'var(--ink-700)' }}>
              Nothing here right now, <Link href="/shop" className="text-link">browse the full catalogue</Link>.
            </p>
          )}
        </div>
      </section>

      <section className="container" style={{ paddingTop: 8, paddingBottom: 'var(--section-gap)' }}>
        <h2 className="display-l" style={{ fontSize: '1.5rem', margin: '0 0 16px' }}>
          {label}, frequently asked
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {faqs.map((f, i) => (
            <details key={i} style={{ borderBottom: '1px solid var(--line)', padding: '12px 0' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9375rem', color: 'var(--ink-900)' }}>{f.q}</summary>
              <p className="body-text" style={{ color: 'var(--ink-700)', margin: '8px 0 0', maxWidth: 760 }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {guides.length > 0 && (
        <section className="container" style={{ paddingBottom: 'var(--section-gap)' }}>
          <h2 className="display-l" style={{ fontSize: '1.5rem', margin: '0 0 16px' }}>
            Guides worth reading
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {guides.map(g => (
              <li key={g.slug}>
                <Link
                  href={`/blog/${g.slug}`}
                  className="text-link"
                  style={{ display: 'block', padding: '12px 16px', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.4 }}
                >
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
