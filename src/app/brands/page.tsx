export const revalidate = 300;

import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getProducts } from '@/lib/supabase';
import { Overline } from '@/components/ui/Overline';
import { pageMeta, jsonLd, breadcrumbLd } from '@/lib/seo';
import { getBrandDirectory } from '@/lib/brands';

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta({
    title: 'Beauty, Skincare & Makeup Brands in Pakistan',
    description: 'Browse every brand at Yellow Pink — authentic imported skincare, makeup and wellness brands like CeraVe, Anua, The Ordinary and Beauty of Joseon, with cash on delivery across Pakistan.',
    path: '/brands',
  });
}

export default async function BrandsPage() {
  const products = await getProducts();
  const brands = await getBrandDirectory(products);

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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--gutter)' }}>
              {brands.map(b => {
                // Logo is the uploaded brand asset if set, otherwise the first
                // product image — same auto-cover idea collections use, so the
                // grid is never a bare text wall.
                const tile = b.logo_url || b.product_image_url;
                return (
                  <Link
                    key={b.slug}
                    href={`/brand/${b.slug}`}
                    style={{
                      display: 'flex', flexDirection: 'column',
                      background: '#fff',
                      borderRadius: 'var(--radius-card)', border: '1px solid var(--line)',
                      textDecoration: 'none', color: 'inherit', overflow: 'hidden',
                    }}
                  >
                    <div style={{
                      position: 'relative', width: '100%', aspectRatio: '4 / 3',
                      background: 'var(--paper2)',
                    }}>
                      {tile ? (
                        <Image
                          src={tile}
                          alt={b.name}
                          fill
                          sizes="(max-width: 768px) 50vw, 220px"
                          style={{ objectFit: b.logo_url ? 'contain' : 'cover', padding: b.logo_url ? 18 : 0 }}
                        />
                      ) : (
                        <span aria-hidden="true" style={{
                          position: 'absolute', inset: 0, display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-display)', fontWeight: 700,
                          fontSize: '1.75rem', color: 'var(--ink-300)',
                        }}>{b.name.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div style={{ padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.0625rem', letterSpacing: '-0.01em' }}>
                        {b.name}
                      </span>
                      <span className="small-text" style={{ color: 'var(--ink-500)' }}>
                        {b.count} {b.count === 1 ? 'product' : 'products'}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
