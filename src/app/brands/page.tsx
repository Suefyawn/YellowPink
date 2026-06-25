export const revalidate = 300;

import type { Metadata } from 'next';
import Link from 'next/link';
import { getProducts } from '@/lib/supabase';
import { Overline } from '@/components/ui/Overline';
import { pageMeta, jsonLd, breadcrumbLd } from '@/lib/seo';
import { brandsFromProducts } from '@/lib/brands';

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta({
    title: 'Beauty, Skincare & Makeup Brands in Pakistan',
    description: 'Browse every brand at Yellow Pink — authentic imported skincare, makeup and wellness brands like CeraVe, Anua, The Ordinary and Beauty of Joseon, with cash on delivery across Pakistan.',
    path: '/brands',
  });
}

export default async function BrandsPage() {
  const products = await getProducts();
  const brands = brandsFromProducts(products);

  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Brands', path: '/brands' }])) }}
      />
      <section style={{ padding: '48px 0 0' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Shop by brand</Overline>
          <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>All Brands</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 520, marginBottom: 32 }}>
            {brands.length} {brands.length === 1 ? 'brand' : 'brands'} — every one authentic and imported. Tap a brand to see its range.
          </p>
        </div>
      </section>

      <section style={{ paddingBottom: 'var(--section-gap)' }}>
        <div className="container">
          {brands.length === 0 ? (
            <p className="body-text" style={{ color: 'var(--ink-700)' }}>
              No brands yet — <Link href="/shop" className="text-link">browse the catalogue</Link>.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--gutter)' }}>
              {brands.map(b => (
                <Link
                  key={b.slug}
                  href={`/brand/${b.slug}`}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6,
                    padding: '20px 22px', background: '#fff',
                    borderRadius: 'var(--radius-card)', border: '1px solid var(--line)',
                    textDecoration: 'none', color: 'inherit',
                  }}
                >
                  <span aria-hidden="true" style={{ width: 24, height: 4, background: 'var(--brand-yellow)', borderRadius: 2 }} />
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.0625rem', letterSpacing: '-0.01em' }}>
                    {b.name}
                  </span>
                  <span className="small-text" style={{ color: 'var(--ink-500)' }}>
                    {b.count} {b.count === 1 ? 'product' : 'products'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
