export const revalidate = 3600; // writes bust explicitly (revalidateStorefrontCatalog); long window = warm cache

import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getProducts } from '@/lib/supabase';
import { Overline } from '@/components/ui/Overline';
import { pageMeta, jsonLd, breadcrumbLd } from '@/lib/seo';
import { getBrandDirectory } from '@/lib/brands';
import { monogramGradient, monogramInitials } from '@/lib/monogram';

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta({
    title: 'Beauty, Skincare & Makeup Brands in Pakistan',
    description: 'Browse every brand at Yellow Pink, authentic imported skincare, makeup and wellness brands like CeraVe, Anua, The Ordinary and Beauty of Joseon, with cash on delivery across Pakistan.',
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
            {brands.length} {brands.length === 1 ? 'brand' : 'brands'}, every one authentic and imported. Tap a brand to see its range.
          </p>
        </div>
      </section>

      <section style={{ paddingBottom: 'var(--section-gap)' }}>
        <div className="container">
          {brands.length === 0 ? (
            <p className="body-text" style={{ color: 'var(--ink-700)' }}>
              No brands yet, <Link href="/shop" className="text-link">browse the catalogue</Link>.
            </p>
          ) : (
            <div className="brands-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--gutter)' }}>
              {brands.map(b => {
                // Logo is the uploaded brand asset if set, otherwise the first
                // product image, same auto-cover idea collections use, so the
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
                    <div className="brand-card-media" style={{
                      position: 'relative', width: '100%', aspectRatio: '4 / 3',
                      // Image-less brands get the shared monogram-gradient tile
                      // (same treatment as image-less blog/product tiles), not a
                      // flat blank beige rectangle.
                      background: tile ? 'var(--paper2)' : monogramGradient(b.name),
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
                          fontFamily: 'var(--font-display)', fontWeight: 500,
                          fontSize: '1.75rem', letterSpacing: '0.05em',
                          color: 'rgba(17,24,39,0.45)', userSelect: 'none',
                        }}>{monogramInitials(b.name)}</span>
                      )}
                    </div>
                    <div className="brand-card-body" style={{ padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="brand-card-name" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.0625rem', letterSpacing: '-0.01em' }}>
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

      {/* Mobile: auto-fill minmax(220px, 1fr) resolves to ONE column of huge
          cards on a phone — 39 brands is ~16,500px of scrolling. Force two
          columns of compact tiles (smaller media area, tighter body) below
          700px; desktop keeps the larger cards. !important because the grid
          declares its desktop template inline. */}
      <style>{`
        @media (max-width: 700px) {
          .brands-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; }
          .brands-grid .brand-card-media { aspect-ratio: 16 / 10 !important; }
          .brands-grid .brand-card-body { padding: 10px 12px 12px !important; gap: 2px !important; }
          .brands-grid .brand-card-name { font-size: 0.9375rem !important; }
        }
      `}</style>
    </main>
  );
}
