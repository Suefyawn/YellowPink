export const revalidate = 300;

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProducts, supabase, isDemo } from '@/lib/supabase';
import { ProductBrowser } from '@/components/shop/ProductBrowser';
import { Overline } from '@/components/ui/Overline';
import { pageMeta, jsonLd, breadcrumbLd, itemListLd } from '@/lib/seo';
import { redirectIfMapped } from '@/lib/redirects';
import type { Product } from '@/types';

// Resolve a tag slug → { name, productIds }. Returns null when the tag
// doesn't exist so the route can 404 cleanly.
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
  if (!tag) return pageMeta({ title: 'Tag', description: 'Shop by tag at Yellow Pink.', path: `/tag/${slug}` });
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
  return pageMeta({
    title: `${tag.name}, Shop`,
    description: `Shop ${tag.name} at Yellow Pink, authentic, imported skincare, makeup and wellness, with cash-on-delivery nationwide in Pakistan.`,
    path: `/tag/${slug}`,
    image: ogImage,
  });
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [tag, products] = await Promise.all([loadTag(slug), getProducts()]);
  // Legacy WP taxonomy (incl. /product-tag/* funnelled here by the proxy) often
  // has no live tag, honour a manual redirect before 404ing.
  if (!tag) { await redirectIfMapped(`/tag/${slug}`); notFound(); }

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
            __html: jsonLd(itemListLd(`${tag.name} products`, list.slice(0, 24).map((p: Product) => ({ name: p.name, path: `/product/${p.slug}` })))),
          }}
        />
      )}

      <section style={{ padding: '48px 0 0', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Tagged</Overline>
          <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>{tag.name}</h1>
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
