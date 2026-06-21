export const revalidate = 300;

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProducts } from '@/lib/supabase';
import { ProductBrowser } from '@/components/shop/ProductBrowser';
import { Overline } from '@/components/ui/Overline';
import { pageMeta, jsonLd, breadcrumbLd, itemListLd } from '@/lib/seo';
import { brandNameFromSlug, brandSlug } from '@/lib/brands';
import type { Product } from '@/types';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const products = await getProducts();
  const brand = brandNameFromSlug(slug, products);
  if (!brand) return pageMeta({ title: 'Brand', description: 'Shop by brand at Yellow Pink.', path: `/brand/${slug}` });
  // Lead the title with "Buy <brand> in Pakistan" — PK shoppers search the
  // brand name + "pakistan" (e.g. "cerave pakistan", "the ordinary pakistan"),
  // so front-loading that intent beats a bare "<brand> — Shop".
  return pageMeta({
    title: `Buy ${brand} in Pakistan — Authentic`,
    description: `Shop authentic, imported ${brand} in Pakistan at Yellow Pink — original products at the best prices, with cash on delivery nationwide.`,
    path: `/brand/${brandSlug(brand)}`,
    keywords: [brand, `${brand} Pakistan`, `${brand} price in Pakistan`, 'COD'],
  });
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const products = await getProducts();
  const brand = brandNameFromSlug(slug, products);
  if (!brand) notFound();

  const list = products.filter(p => p.brand === brand);
  const breadcrumb = [
    { name: 'Home', path: '/' },
    { name: 'Brands', path: '/brands' },
    { name: brand, path: `/brand/${brandSlug(brand)}` },
  ];

  return (
    <main className="fade-in">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd(breadcrumb)) }} />
      {list.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(itemListLd(`${brand} products`, list.slice(0, 24).map((p: Product) => ({ name: p.name, path: `/product/${p.slug}` })))),
          }}
        />
      )}

      <section style={{ padding: '48px 0 0', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>
            <Link href="/brands" style={{ color: 'inherit', textDecoration: 'none' }}>Brands</Link> / {brand}
          </Overline>
          <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>{brand}</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 520, marginBottom: 0 }}>
            Explore the full {brand} range at Yellow Pink — 100% authentic, imported, with cash-on-delivery across Pakistan.
          </p>
        </div>
      </section>

      <section style={{ padding: 'var(--section-gap) 0' }}>
        <div className="container">
          {list.length > 0 ? (
            <ProductBrowser products={list} />
          ) : (
            <p className="body-text" style={{ color: 'var(--ink-700)' }}>
              This brand is restocking — <Link href="/shop" className="text-link">browse the full catalogue</Link> in the meantime.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
