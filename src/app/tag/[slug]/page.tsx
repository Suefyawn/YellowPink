export const revalidate = 300;

import type { Metadata } from 'next';
import Link from 'next/link';
import { permanentRedirect } from 'next/navigation';
import { getProducts, supabase, isDemo } from '@/lib/supabase';
import { ProductBrowser } from '@/components/shop/ProductBrowser';
import { Overline } from '@/components/ui/Overline';
import { pageMeta, jsonLd, breadcrumbLd, itemListLd, productInStock } from '@/lib/seo';
import { redirectIfMapped } from '@/lib/redirects';
import type { Product } from '@/types';

// Resolve a tag slug → { name, productIds }. Returns null when the tag
// doesn't exist so the route can fall through to shop search.
async function loadTag(slug: string): Promise<{ name: string; productIds: Set<string> } | null> {
  if (isDemo) return null;
  const { data: tag } = await supabase.from('product_tags').select('id, name').eq('slug', slug).maybeSingle();
  const row = tag as { id: string; name: string } | null;
  if (!row) return null;
  const { data: mapRows } = await supabase.from('product_tag_map').select('product_id').eq('tag_id', row.id);
  return { name: row.name, productIds: new Set(((mapRows ?? []) as Array<{ product_id: string }>).map(r => r.product_id)) };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tag = await loadTag(slug);
  // Unknown tag → resolve HERE, in metadata: with streaming, anything thrown
  // only in the page body lands after the 200 status has been committed.
  // Order: a manual redirect mapping wins; otherwise fall through to shop
  // search for the tag's words. A tag IS a keyword, so search is the natural
  // successor page for the long tail of dead WordPress-era tag URLs bots keep
  // re-crawling — the visitor gets matching products instead of a 404, and
  // the admin Broken-links queue stops accumulating them. /shop?q= is
  // noindex, so the old thin tag URLs drop out of Google either way.
  if (!tag) {
    await redirectIfMapped(`/tag/${slug}`);
    permanentRedirect(`/shop?q=${encodeURIComponent(slug.replace(/-/g, ' '))}`);
  }
  // One representative packshot for the social card (single lightweight query
  // over just this tag's products) rather than the generic branded fallback.
  let ogImage: string | undefined;
  if (!isDemo && tag.productIds.size) {
    const { data: img } = await supabase
      .from('products')
      .select('image_url')
      .in('id', [...tag.productIds])
      .not('image_url', 'is', null)
      .limit(1)
      .maybeSingle();
    ogImage = (img as { image_url?: string } | null)?.image_url || undefined;
  }
  // Keep an empty tag (no published members) out of the index — a bare grid
  // with a templated title is thin content. getProducts() is cached, so this
  // membership count is effectively free.
  const publishedCount = isDemo ? 0 : (await getProducts()).filter(p => tag.productIds.has(p.id)).length;
  return pageMeta({
    title: `Shop ${tag.name} in Pakistan`,
    description: `Shop ${tag.name} at Yellow Pink, authentic, imported skincare, makeup and wellness, with cash-on-delivery nationwide in Pakistan.`,
    path: `/tag/${slug}`,
    noIndex: publishedCount === 0,
    image: ogImage,
  });
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [tag, products] = await Promise.all([loadTag(slug), getProducts()]);
  // Legacy WP taxonomy (incl. /product-tag/* funnelled here by the proxy) often
  // has no live tag, honour a manual redirect before 404ing.
  if (!tag) {
    // Kept in sync with generateMetadata (which resolves first at runtime).
    await redirectIfMapped(`/tag/${slug}`);
    permanentRedirect(`/shop?q=${encodeURIComponent(slug.replace(/-/g, ' '))}`);
  }

  const list = products.filter(p => tag.productIds.has(p.id));
  const breadcrumb = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    { name: tag.name, path: `/tag/${slug}` },
  ];

  return (
    <main className="fade-in">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd(breadcrumb)) }} />
      {list.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(itemListLd(`${tag.name} products`, list.slice(0, 24).map((p: Product) => ({ name: p.name, path: `/product/${p.slug}`, image: p.image_url, brand: p.brand, price: p.price, inStock: productInStock(p) })))),
          }}
        />
      )}

      <section style={{ padding: '48px 0 0', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Tagged</Overline>
          <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>{tag.name}</h1>
          {list.length > 0 && (
            <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 520, marginBottom: 8 }}>
              {list.length} {list.length === 1 ? 'product' : 'products'} tagged &ldquo;{tag.name}&rdquo; at Yellow Pink — 100% authentic and imported, with cash on delivery nationwide across Pakistan.
            </p>
          )}
        </div>
      </section>

      <section style={{ padding: 'var(--section-gap) 0' }}>
        <div className="container">
          {list.length > 0 ? (
            <ProductBrowser products={list} />
          ) : (
            <p className="body-text" style={{ color: 'var(--ink-700)' }}>
              Nothing here yet, <Link href="/shop" className="text-link">browse the full catalogue</Link>.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
