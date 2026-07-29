// Indexable deals landing page. High-intent "sale / discount / deals" +
// brand queries (which spike around 11.11 and Eid) previously had no landing
// URL: the /shop?on_sale=1 filter view canonicalized back to /shop, so the
// site forfeited both the SERP entry and a natural internal-link hub for
// discounted products. Shopify competitors ship /collections/sale by default.
//
// ISR like other landings; the page renders whatever is genuinely discounted
// right now (original_price > price), so it stays truthful year-round and
// simply thins out between sale seasons. NO loading.tsx in this segment
// (loading boundaries downgrade metadata-thrown statuses to soft responses).
export const revalidate = 3600; // writes bust explicitly (revalidateStorefrontCatalog); long window = warm cache

import type { Metadata } from 'next';
import Link from 'next/link';
import { getProducts } from '@/lib/supabase';
import { ProductTile } from '@/components/ui/ProductTile';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Overline } from '@/components/ui/Overline';
import { pageMeta, jsonLd, breadcrumbLd, itemListLd, productInStock } from '@/lib/seo';
import type { Product } from '@/types';

export const metadata: Metadata = pageMeta({
  title: 'Deals & Sale — Beauty and Supplements Discounts in Pakistan',
  description:
    'Shop genuine discounts at Yellow Pink — imported skincare, makeup and supplements on sale, 100% authentic, with cash on delivery across Pakistan. Updated daily.',
  path: '/deals',
});

const onSale = (p: Product) =>
  p.original_price != null && Number(p.original_price) > Number(p.price);

export default async function DealsPage() {
  const products = await getProducts();
  const deals = products
    .filter(onSale)
    // Deepest discounts first — the page should lead with its best offers.
    .sort((a, b) =>
      (Number(b.original_price) - b.price) / Number(b.original_price)
      - (Number(a.original_price) - a.price) / Number(a.original_price));

  const breadcrumb = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    { name: 'Deals', path: '/deals' },
  ];

  return (
    <main className="fade-in">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd(breadcrumb)) }} />
      {deals.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(itemListLd('Deals & sale products', deals.slice(0, 24).map(p => ({
              name: p.name, path: `/product/${p.slug}`, image: p.image_url,
              brand: p.brand, price: p.price, inStock: productInStock(p),
            })))),
          }}
        />
      )}
      <Breadcrumbs items={breadcrumb} />

      <section style={{ padding: '48px 0 0', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Limited-time prices</Overline>
          <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>Deals &amp; Sale</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 720, marginBottom: 24 }}>
            Every product here carries a genuine discount off its regular price — imported skincare,
            makeup and wellness supplements, all 100% authentic and sealed, with cash on delivery
            nationwide across Pakistan. Prices update as offers start and end, so what you see is
            what&apos;s really on sale today.
          </p>
        </div>
      </section>

      <section style={{ padding: 'var(--section-gap) 0' }}>
        <div className="container">
          {deals.length > 0 ? (
            <>
              <p className="small-text" style={{ marginBottom: 20 }}>
                {deals.length} {deals.length === 1 ? 'product' : 'products'} on sale
              </p>
              <div className="product-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }}>
                {deals.map(p => <ProductTile key={p.id} product={p} />)}
              </div>
            </>
          ) : (
            <p className="body-text" style={{ color: 'var(--ink-700)' }}>
              No active discounts right now — new offers land regularly, or{' '}
              <Link href="/shop" className="text-link">browse the full catalogue</Link>.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
