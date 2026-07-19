// Human-readable HTML sitemap at /sitemap. Complements the machine
// /sitemap.xml: it gives shoppers a single index of the whole store and,
// for SEO, a flat internal-linking hub that puts every category, brand,
// collection and blog post one click from a crawlable page (helps deep
// pages that the nav doesn't link directly). ISR-cached like the rest of
// the storefront.
export const revalidate = 600;
// Read live rows on every regeneration (see the matching note in app/sitemap.ts).
export const fetchCache = 'force-no-store';

import type { Metadata } from 'next';
import Link from 'next/link';
import { getProducts, getBlogPosts, supabase, isDemo } from '@/lib/supabase';
import { Overline } from '@/components/ui/Overline';
import { pageMeta, jsonLd, breadcrumbLd } from '@/lib/seo';
import { brandsFromProducts } from '@/lib/brands';
import { TAXONS, taxonForCategory, categoryHref } from '@/lib/category-taxonomy';
import { brandPlusName } from '@/lib/product-display';

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta({
    title: 'Sitemap',
    description:
      'Browse everything at Yellow Pink in one place, shop categories, brands, collections and our beauty & wellness journal. Authentic imported products with cash on delivery across Pakistan.',
    path: '/sitemap',
  });
}

const MAIN_PAGES: { label: string; path: string }[] = [
  { label: 'Home', path: '/' },
  { label: 'Shop all', path: '/shop' },
  { label: 'Collections', path: '/collections' },
  { label: 'Brands', path: '/brands' },
  { label: 'K-Beauty', path: '/k-beauty' },
  { label: 'Journal (Blog)', path: '/blog' },
  // /page/contact directly: /contact is a 301 alias (proxy.ts), and linking
  // the redirect wastes a hop on every crawl.
  { label: 'Contact', path: '/page/contact' },
  { label: 'Track order', path: '/track' },
];

const sectionStyle: React.CSSProperties = { marginBottom: 40 };
const listStyle: React.CSSProperties = {
  listStyle: 'none', margin: 0, padding: 0,
  columns: '240px 3', columnGap: 28,
};
const linkStyle: React.CSSProperties = {
  display: 'block', padding: '5px 0', color: 'var(--ink-700)',
  textDecoration: 'none', fontSize: '0.9375rem', breakInside: 'avoid',
};

export default async function HtmlSitemapPage() {
  const [products, posts] = await Promise.all([getProducts(), getBlogPosts()]);

  // Categories grouped under their taxon, matching the storefront's primary
  // navigation so the sitemap mirrors how the catalogue is organised.
  const categories = Array.from(
    new Set(products.map(p => p.category).filter((c): c is string => Boolean(c))),
  ).sort((a, b) => a.localeCompare(b));
  const categoriesByTaxon = TAXONS.map(t => ({
    taxon: t,
    cats: categories.filter(c => taxonForCategory(c)?.key === t.key),
  })).filter(g => g.cats.length > 0);
  const ungrouped = categories.filter(c => !taxonForCategory(c));

  const brands = brandsFromProducts(products);

  // Every product, grouped by category. The whole point of this HTML hub is
  // crawl/indexing: linking each PDP directly here puts every product one click
  // from a crawlable page, so nothing is buried on page 2+ of a paginated
  // category listing (the usual cause of "discovered/crawled, not indexed").
  const productsByCategory = new Map<string, typeof products>();
  for (const p of products) {
    const key = p.category || 'Other';
    if (!productsByCategory.has(key)) productsByCategory.set(key, []);
    productsByCategory.get(key)!.push(p);
  }
  const productGroups = [...productsByCategory.entries()]
    .map(([cat, list]) => [cat, list.slice().sort((a, b) => a.name.localeCompare(b.name))] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));

  // Blog posts grouped by editorial category.
  const postsByCategory = new Map<string, typeof posts>();
  for (const p of posts) {
    const key = p.category || 'Other';
    if (!postsByCategory.has(key)) postsByCategory.set(key, []);
    postsByCategory.get(key)!.push(p);
  }
  const blogGroups = [...postsByCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // Published collections + CMS pages (direct query, no dedicated helper).
  let collections: { slug: string; title: string }[] = [];
  let cmsPages: { slug: string; title: string }[] = [];
  if (!isDemo) {
    const [{ data: colRows }, { data: pageRows }] = await Promise.all([
      supabase.from('collections').select('slug, title').eq('status', 'published').order('title'),
      supabase.from('pages').select('slug, title').eq('status', 'published').order('title'),
    ]);
    collections = (colRows ?? []) as { slug: string; title: string }[];
    cmsPages = (pageRows ?? []) as { slug: string; title: string }[];
  }

  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Sitemap', path: '/sitemap' }])),
        }}
      />
      <section style={{ padding: '48px 0 64px' }}>
        <div className="container" style={{ maxWidth: 1120 }}>
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Everything in one place</Overline>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 500, letterSpacing: '-0.025em', marginBottom: 8 }}>Sitemap</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 640, marginBottom: 40 }}>
            Browse every part of Yellow Pink, shop categories, brands, collections and our journal.
          </p>

          {/* Main pages */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 12 }}>Main pages</h2>
            <ul style={listStyle}>
              {MAIN_PAGES.map(p => (
                <li key={p.path}><Link href={p.path} style={linkStyle}>{p.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Shop by category */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 12 }}>Shop by category</h2>
            {categoriesByTaxon.map(g => (
              <div key={g.taxon.key} style={{ marginBottom: 16 }}>
                <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--ink-500)' }}>{g.taxon.label}</Overline>
                <ul style={listStyle}>
                  {g.cats.map(c => (
                    <li key={c}>
                      <Link href={categoryHref(c)} style={linkStyle}>{c}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {ungrouped.length > 0 && (
              <ul style={listStyle}>
                {ungrouped.map(c => (
                  <li key={c}><Link href={categoryHref(c)} style={linkStyle}>{c}</Link></li>
                ))}
              </ul>
            )}
          </div>

          {/* Collections */}
          {collections.length > 0 && (
            <div style={sectionStyle}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 12 }}>Collections</h2>
              <ul style={listStyle}>
                {collections.map(c => (
                  <li key={c.slug}><Link href={`/collection/${c.slug}`} style={linkStyle}>{c.title}</Link></li>
                ))}
              </ul>
            </div>
          )}

          {/* Brands */}
          {brands.length > 0 && (
            <div style={sectionStyle}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 12 }}>Brands</h2>
              <ul style={listStyle}>
                {brands.map(b => (
                  <li key={b.slug}><Link href={`/brand/${b.slug}`} style={linkStyle}>{b.name}</Link></li>
                ))}
              </ul>
            </div>
          )}

          {/* All products, flat link hub so every PDP is one click from a
              crawlable page (helps Google index the full catalogue). */}
          {productGroups.length > 0 && (
            <div style={sectionStyle}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 12 }}>All products</h2>
              {productGroups.map(([cat, list]) => (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--ink-500)' }}>{cat}</Overline>
                  <ul style={listStyle}>
                    {list.map(p => (
                      <li key={p.id}><Link href={`/product/${p.slug}`} style={linkStyle}>{brandPlusName(p.brand, p.name)}</Link></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Blog */}
          {blogGroups.length > 0 && (
            <div style={sectionStyle}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 12 }}>Journal</h2>
              {blogGroups.map(([cat, group]) => (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--ink-500)' }}>{cat}</Overline>
                  <ul style={listStyle}>
                    {group.map(p => (
                      <li key={p.slug}><Link href={`/blog/${p.slug}`} style={linkStyle}>{p.title}</Link></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Information pages */}
          {cmsPages.length > 0 && (
            <div style={sectionStyle}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 12 }}>Information</h2>
              <ul style={listStyle}>
                {cmsPages.map(p => (
                  <li key={p.slug}><Link href={`/page/${p.slug}`} style={linkStyle}>{p.title}</Link></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
