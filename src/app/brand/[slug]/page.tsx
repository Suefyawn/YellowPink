export const revalidate = 300;

import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getProducts } from '@/lib/supabase';
import { ProductBrowser } from '@/components/shop/ProductBrowser';
import { Overline } from '@/components/ui/Overline';
import { pageMeta, jsonLd, breadcrumbLd, itemListLd } from '@/lib/seo';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { brandNameFromSlug, brandSlug, getBrandRecord } from '@/lib/brands';
import { redirectIfMapped } from '@/lib/redirects';
import type { Product } from '@/types';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [products, record] = await Promise.all([getProducts(), getBrandRecord(slug)]);
  const brand = record?.name ?? brandNameFromSlug(slug, products);
  if (!brand) return pageMeta({ title: 'Brand', description: 'Shop by brand at Yellow Pink.', path: `/brand/${slug}` });
  // Lead the title with "Buy <brand> in Pakistan" — PK shoppers search the
  // brand name + "pakistan" (e.g. "cerave pakistan", "the ordinary pakistan"),
  // so front-loading that intent beats a bare "<brand> — Shop".
  return pageMeta({
    title: record?.seo_title || `Buy ${brand} in Pakistan — Authentic`,
    description: record?.seo_description
      || record?.description
      || `Shop authentic, imported ${brand} in Pakistan at Yellow Pink — original products at the best prices, with cash on delivery nationwide.`,
    path: `/brand/${brandSlug(brand)}`,
    keywords: [brand, `${brand} Pakistan`, `${brand} price in Pakistan`, 'COD'],
    // Representative packshot as the share image (products already fetched
    // above, so this is free) — bespoke social card per brand instead of the
    // generic fallback. Falls through to app/opengraph-image.tsx if none.
    image: products.find(p => p.brand === brand && p.image_url)?.image_url || undefined,
  });
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [products, record] = await Promise.all([getProducts(), getBrandRecord(slug)]);
  const brand = record?.name ?? brandNameFromSlug(slug, products);
  if (!brand) { await redirectIfMapped(`/brand/${slug}`); notFound(); }

  const list = products.filter(p => p.brand === brand);
  const breadcrumb = [
    { name: 'Home', path: '/' },
    { name: 'Brands', path: '/brands' },
    { name: brand, path: `/brand/${brandSlug(brand)}` },
  ];

  // Hero cover — uploaded brand hero, otherwise auto-fall back to the brand's
  // first product image so the page is never a bare text header. The card grid
  // uses the same idea.
  const heroImage = record?.hero_image_url
    || list.find(p => p.image_url)?.image_url
    || null;
  const description = record?.description
    || `Explore the full ${brand} range at Yellow Pink — 100% authentic, imported, with cash-on-delivery across Pakistan.`;

  return (
    <main className="fade-in">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd(breadcrumb)) }} />
      <Breadcrumbs items={breadcrumb} />
      {list.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(itemListLd(`${brand} products`, list.slice(0, 24).map((p: Product) => ({ name: p.name, path: `/product/${p.slug}` })))),
          }}
        />
      )}

      {heroImage ? (
        <section style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', minHeight: 'clamp(280px, 36vh, 420px)' }}>
            <Image src={heroImage} alt={brand} fill priority sizes="100vw" style={{ objectFit: 'cover' }} />
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(250,246,238,0.94) 0%, rgba(250,246,238,0.55) 45%, rgba(250,246,238,0.05) 80%)' }} />
            <div className="container" style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 'clamp(280px, 36vh, 420px)', paddingTop: 40, paddingBottom: 40 }}>
              <div style={{ maxWidth: 540, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Overline style={{ color: 'var(--ink-700)' }}>
                  <Link href="/brands" style={{ color: 'inherit', textDecoration: 'none' }}>Brands</Link> / {brand}
                </Overline>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {record?.logo_url && (
                    <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0, background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                      <Image src={record.logo_url} alt={`${brand} logo`} fill sizes="64px" style={{ objectFit: 'contain', padding: 8 }} />
                    </div>
                  )}
                  <h1 className="display-l" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.06, margin: 0 }}>{brand}</h1>
                </div>
                <p className="body-text" style={{ color: 'var(--ink-700)' }}>{description}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <span className="small-text" style={{ color: 'var(--ink-700)' }}>{list.length} {list.length === 1 ? 'product' : 'products'}</span>
                  <Link href={`/shop?brand=${encodeURIComponent(brand)}`} className="text-link">
                    Filter &amp; sort all {brand} products →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section style={{ padding: '48px 0 0', borderBottom: '1px solid var(--line)' }}>
          <div className="container">
            <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>
              <Link href="/brands" style={{ color: 'inherit', textDecoration: 'none' }}>Brands</Link> / {brand}
            </Overline>
            <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>{brand}</h1>
            <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 520, marginBottom: 20 }}>{description}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
              <span className="small-text">{list.length} {list.length === 1 ? 'product' : 'products'}</span>
              <Link href={`/shop?brand=${encodeURIComponent(brand)}`} className="text-link">
                Filter &amp; sort all {brand} products →
              </Link>
            </div>
          </div>
        </section>
      )}

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
