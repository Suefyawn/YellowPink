export const revalidate = 300;

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProducts, supabase, isDemo } from '@/lib/supabase';
import { Overline } from '@/components/ui/Overline';
import { CollectionGrid } from '@/sections/collection/CollectionGrid';
import { pageMeta, jsonLd, breadcrumbLd, itemListLd } from '@/lib/seo';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { loadTagData } from '@/lib/shop-facets';
import { redirectIfMapped } from '@/lib/redirects';
import { resolveCollectionProducts, type Collection } from '@/lib/collections';
import { CollectionHeroImage } from './CollectionHeroImage';
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
  if (!c) return pageMeta({ title: 'Collection', description: 'Shop our curated collections.', path: `/collection/${slug}` });
  return pageMeta({
    title: c.seo_title || `${c.title}, Shop`,
    description: c.seo_description || c.description || `Shop the ${c.title} collection at Yellow Pink, authentic, imported, with cash-on-delivery nationwide in Pakistan.`,
    path: `/collection/${c.slug}`,
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

  return (
    <main className="fade-in">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd(breadcrumb)) }} />
      <Breadcrumbs items={breadcrumb} />
      {list.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(itemListLd(c.title, list.slice(0, 24).map((p: Product) => ({ name: p.name, path: `/product/${p.slug}`, image: p.image_url, brand: p.brand, price: p.price })))),
          }}
        />
      )}

      {/* Hero */}
      {heroImage ? (
        <section style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', minHeight: 'clamp(300px, 40vh, 460px)' }}>
            {/* Branded gradient underlay (same wash as the collection cards),
                so a slow or broken hero image never leaves a dead grey band
                behind the title. */}
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(140deg, #fde7f0 0%, #faf6ee 55%, #fff8e1 100%)' }} />
            <CollectionHeroImage src={heroImage} alt={c.title} />
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(250,246,238,0.92) 0%, rgba(250,246,238,0.55) 45%, rgba(250,246,238,0.05) 80%)' }} />
            <div className="container" style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 'clamp(300px, 40vh, 460px)', paddingTop: 40, paddingBottom: 40 }}>
              <div style={{ maxWidth: 520 }}>
                <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-700)' }}>Collection</Overline>
                <h1 className="display-l" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', marginBottom: 14, lineHeight: 1.06 }}>{c.title}</h1>
                {c.description && <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 440 }}>{c.description}</p>}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section style={{ padding: '48px 0 0', borderBottom: '1px solid var(--line)' }}>
          <div className="container">
            <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Collection</Overline>
            <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>{c.title}</h1>
            {c.description && <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 520, marginBottom: 24 }}>{c.description}</p>}
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
    </main>
  );
}
