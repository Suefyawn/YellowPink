export const revalidate = 3600; // writes bust explicitly (revalidateStorefrontCatalog); long window = warm cache

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProducts, supabase, isDemo } from '@/lib/supabase';
import { Overline } from '@/components/ui/Overline';
import { CollectionGrid } from '@/sections/collection/CollectionGrid';
import { pageMeta, jsonLd, breadcrumbLd, itemListLd, productInStock } from '@/lib/seo';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { loadTagData } from '@/lib/shop-facets';
import { redirectIfMapped } from '@/lib/redirects';
import { resolveCollectionProducts, type Collection } from '@/lib/collections';
import { CollectionHeroImage } from './CollectionHeroImage';
import { ContentAndFaqs } from '@/components/seo/ContentAndFaqs';
import { renderPriceTokens, renderFaqPriceTokens } from '@/lib/price-tokens';
import type { Product } from '@/types';

// Published collection by slug. Anon RLS already restricts to published, but we
// also filter explicitly so demo / service-role paths behave the same.
async function loadCollection(slug: string): Promise<Collection | null> {
  if (isDemo) return null;
  const { data } = await supabase.from('collections').select('*').eq('slug', slug).eq('status', 'published').maybeSingle();
  return (data as Collection | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await loadCollection(slug);
  // Unknown collection → real HTTP 404 from the metadata boundary (a
  // body-only notFound() streams in after the 200 commits — soft-404).
  if (!c) { await redirectIfMapped(`/collection/${slug}`); notFound(); }
  // Keep a contentless (empty) collection out of the index — a published-but-
  // empty edit is thin content. Membership is enough (ordering doesn't matter
  // here), so we skip the manual-position query.
  const [products, tagData] = await Promise.all([getProducts(), loadTagData()]);
  const memberCount = resolveCollectionProducts(c, products, { productTagMap: tagData.productTagMap }).length;
  return pageMeta({
    title: c.seo_title || `${c.title}, Shop`,
    description: c.seo_description || c.description || `Shop the ${c.title} collection at Yellow Pink, authentic, imported, with cash-on-delivery nationwide in Pakistan.`,
    path: `/collection/${c.slug}`,
    noIndex: memberCount === 0,
    // Use the collection's own hero as the share image so social cards /
    // SERP thumbnails are bespoke per collection instead of the generic
    // branded fallback. Falls through to app/opengraph-image.tsx when a
    // collection has no hero set.
    image: c.hero_image_url || undefined,
  });
}

export default async function CollectionPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await loadCollection(slug);
  if (!c) { await redirectIfMapped(`/collection/${slug}`); notFound(); }

  const [products, tagData] = await Promise.all([getProducts(), loadTagData()]);

  // Manual collections need their explicit ordering; smart ones need the tag
  // map to evaluate tag conditions.
  let manualOrder: Map<string, number> | undefined;
  if (c.type === 'manual') {
    const { data: rows } = await supabase.from('collection_products').select('product_id, position').eq('collection_id', c.id);
    manualOrder = new Map(((rows ?? []) as Array<{ product_id: string; position: number }>).map(r => [r.product_id, r.position]));
  }
  const list = resolveCollectionProducts(c, products, { manualOrder, productTagMap: tagData.productTagMap });

  // Hero cover: the collection's own hero_image_url when set, otherwise the
  // first member product's image, the same fallback the collection cards use
  // (getPublishedCollectionsWithCovers), so the detail hero is never a bare
  // text block while every collection still has a null hero in the DB.
  const heroImage = c.hero_image_url || list.find(p => p.image_url)?.image_url || null;

  const breadcrumb = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    { name: c.title, path: `/collection/${c.slug}` },
  ];

  // On-page intro copy: the admin blurb when set, else a keyword-led fallback
  // so a collection is never a bare H1 + grid (matches the brand-page pattern
  // and gives the page indexable content). Not shown when the collection is
  // empty (that page is noindexed anyway).
  const introCopy = c.description
    || (list.length > 0
      ? `Explore the ${c.title} edit at Yellow Pink — ${list.length} handpicked, 100% authentic ${list.length === 1 ? 'product' : 'products'}, imported and delivered with cash on delivery across Pakistan.`
      : null);

  return (
    <main className="fade-in">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd(breadcrumb)) }} />
      <Breadcrumbs items={breadcrumb} />
      {list.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(itemListLd(c.title, list.slice(0, 24).map((p: Product) => ({ name: p.name, path: `/product/${p.slug}`, image: p.image_url, brand: p.brand, price: p.price, inStock: productInStock(p) })))),
          }}
        />
      )}

      {/* Hero */}
      {heroImage ? (
        <section style={{ position: 'relative', overflow: 'hidden' }}>
          {/* .collection-hero: phones compress the 300px+ hero to ~210px
              (globals.css) so products start inside the first screen. */}
          <div className="collection-hero" style={{ position: 'relative', minHeight: 'clamp(300px, 40vh, 460px)' }}>
            {/* Branded gradient underlay (same wash as the collection cards),
                so a slow or broken hero image never leaves a dead grey band
                behind the title. */}
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(140deg, #fde7f0 0%, #faf6ee 55%, #fff8e1 100%)' }} />
            <CollectionHeroImage src={heroImage} alt={c.title} />
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(250,246,238,0.92) 0%, rgba(250,246,238,0.55) 45%, rgba(250,246,238,0.05) 80%)' }} />
            <div className="container collection-hero" style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 'clamp(300px, 40vh, 460px)', paddingTop: 40, paddingBottom: 40 }}>
              <div style={{ maxWidth: 520 }}>
                <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-700)' }}>Collection</Overline>
                <h1 className="display-l" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', marginBottom: 14, lineHeight: 1.06 }}>{c.title}</h1>
                {introCopy && <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 440 }}>{introCopy}</p>}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="shop-header" style={{ padding: '48px 0 0', borderBottom: '1px solid var(--line)' }}>
          <div className="container">
            <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Collection</Overline>
            <h1 className="display-l shop-heading" style={{ fontSize: '2.5rem', marginBottom: 12 }}>{c.title}</h1>
            {introCopy && <p className="body-text shop-intro" style={{ color: 'var(--ink-700)', maxWidth: 520, marginBottom: 24 }}>{introCopy}</p>}
            <p className="small-text" style={{ marginBottom: 28 }}>{list.length} {list.length === 1 ? 'product' : 'products'}</p>
          </div>
        </section>
      )}

      <section style={{ padding: 'var(--section-gap) 0' }}>
        <div className="container">
          {list.length > 0 ? (
            <CollectionGrid products={list} basePath={`/collection/${c.slug}`} />
          ) : (
            <p className="body-text" style={{ color: 'var(--ink-700)' }}>
              This collection is being curated, <Link href="/shop" className="text-link">browse the full catalogue</Link> in the meantime.
            </p>
          )}
        </div>
      </section>

      {/* Long-form hub content + FAQs, for collections that have to rank for
          a category query rather than just merchandise one. Same component
          and trust model as the brand pages. */}
      <ContentAndFaqs
        html={renderPriceTokens(c.content_html, products)}
        faqs={renderFaqPriceTokens(c.faqs, products)}
        faqHeading={`${c.title} FAQs`}
      />
    </main>
  );
}
