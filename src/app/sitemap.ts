// Single comprehensive sitemap. The catalog (a few hundred URLs) is far
// below Google's 50,000-per-sitemap cap, so one flat sitemap is the
// recommended shape — simpler than a sitemap index, and submitting
// /sitemap.xml in Search Console discovers every page in one pass.

import type { MetadataRoute } from 'next';
import { supabase, isDemo } from '@/lib/supabase';
import { SITE_URL, absoluteUrl } from '@/lib/seo';
import { brandSlug } from '@/lib/brands';

// Regenerate hourly so posts/products added via the DB, the blog API or the
// admin (none of which trigger a deploy) appear in the sitemap within an hour.
// Without this the sitemap is built once at deploy time and silently goes stale
// as new content is published.
export const revalidate = 3600;

// Robots-disallowed (utility / private) routes are deliberately excluded —
// listing them would send a conflicting signal to crawlers.
const STATIC_ROUTES: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/',           priority: 1.0, freq: 'daily' },
  { path: '/shop',       priority: 0.9, freq: 'daily' },
  { path: '/collections', priority: 0.7, freq: 'weekly' },
  { path: '/brands',     priority: 0.6, freq: 'weekly' },
  { path: '/k-beauty',   priority: 0.8, freq: 'weekly' },
  { path: '/quiz',       priority: 0.6, freq: 'monthly' },
  { path: '/blog',       priority: 0.7, freq: 'weekly' },
  { path: '/medical-review-board', priority: 0.5, freq: 'monthly' },
  { path: '/sitemap',    priority: 0.3, freq: 'weekly' },
  // NOTE: /faq is intentionally NOT listed — it 301-redirects to the CMS page
  // /page/faq (see proxy.ts PAGE_SLUG_MAP), which is already emitted in the
  // published-pages section below. Listing the redirecting URL would be a
  // self-referential crawl waste.
];

interface ProductRow {
  slug: string;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  updated_at: string | null;
  created_at: string | null;
}
interface PostRow {
  slug: string;
  image_url: string | null;
  updated_at: string | null;
  date: string | null;
}
interface PageRow {
  slug: string;
  updated_at: string | null;
  created_at: string | null;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  let products: ProductRow[] = [];
  let posts: PostRow[] = [];
  let pages: PageRow[] = [];

  if (isDemo) {
    const { DEMO_PRODUCTS, DEMO_BLOG_POSTS, DEMO_PAGES } = await import('@/lib/demo-data');
    products = DEMO_PRODUCTS.map(p => ({
      slug: p.slug, brand: p.brand ?? null, category: p.category ?? null, image_url: p.image_url ?? null,
      updated_at: null, created_at: null,
    }));
    posts = DEMO_BLOG_POSTS.map(p => ({
      slug: p.slug, image_url: p.image_url ?? null, updated_at: null, date: p.date ?? null,
    }));
    pages = DEMO_PAGES.map(p => ({ slug: p.slug, updated_at: null, created_at: null }));
  } else {
    // Only published products / pages — drafts and archived rows must not
    // appear in the sitemap (they 404 or noindex).
    const [prod, blog, cms] = await Promise.all([
      supabase.from('products').select('slug, brand, category, image_url, updated_at, created_at').eq('status', 'published'),
      supabase.from('blog_posts').select('slug, image_url, updated_at, date'),
      supabase.from('pages').select('slug, updated_at, created_at').eq('status', 'published'),
    ]);
    products = (prod.data ?? []) as ProductRow[];
    posts = (blog.data ?? []) as PostRow[];
    pages = (cms.data ?? []) as PageRow[];
  }

  // Tag archive pages (/tag/[slug]) — every tag that has at least one product.
  // Collection pages (/collection/[slug]) — published collections only.
  let tagSlugs: string[] = [];
  let collectionSlugs: string[] = [];
  let reviewerSlugs: string[] = [];
  if (!isDemo) {
    const [{ data: tagRows }, { data: colRows }, { data: revRows }] = await Promise.all([
      supabase.from('product_tags').select('slug'),
      supabase.from('collections').select('slug').eq('status', 'published'),
      supabase.from('content_reviewers').select('slug').eq('active', true),
    ]);
    tagSlugs = ((tagRows ?? []) as Array<{ slug: string }>).map(t => t.slug);
    collectionSlugs = ((colRows ?? []) as Array<{ slug: string }>).map(c => c.slug);
    reviewerSlugs = ((revRows ?? []) as Array<{ slug: string }>).map(r => r.slug);
  }

  const staticUrls: MetadataRoute.Sitemap = STATIC_ROUTES.map(r => ({
    url: absoluteUrl(r.path),
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }));

  // Category landing pages — ?category= matches what canonical / breadcrumb /
  // footer links emit, so the sitemap and the canonical agree.
  const categories = Array.from(
    new Set(products.map(p => p.category).filter((c): c is string => Boolean(c))),
  );
  const categoryUrls: MetadataRoute.Sitemap = categories.map(cat => ({
    // Build the query string exactly as the shop page's self-canonical does
    // (URLSearchParams → space "+", "'" "%27"). Using encodeURIComponent here
    // produced "%20"/raw "'", which differs from the canonical, so GSC flagged
    // every multi-word category ("Women's Health", "Face Makeup", …) as
    // "Alternate page with proper canonical tag" — the sitemap "errors".
    url: `${SITE_URL}/shop?${new URLSearchParams({ category: cat }).toString()}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  // Brand archive pages (/brand/[slug]) — one per distinct brand.
  const brands = Array.from(new Set(products.map(p => p.brand).filter((b): b is string => Boolean(b))));
  const brandUrls: MetadataRoute.Sitemap = brands.map(brand => ({
    url: absoluteUrl(`/brand/${brandSlug(brand)}`),
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  // Tag archive pages (/tag/[slug]).
  const tagUrls: MetadataRoute.Sitemap = tagSlugs.map(slug => ({
    url: absoluteUrl(`/tag/${slug}`),
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  // Collection landing pages (/collection/[slug]).
  const collectionUrls: MetadataRoute.Sitemap = collectionSlugs.map(slug => ({
    url: absoluteUrl(`/collection/${slug}`),
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  // Medical Review Board profile pages (/medical-review-board/[slug]) — E-E-A-T
  // expertise nodes, worth crawling/indexing.
  const reviewerUrls: MetadataRoute.Sitemap = reviewerSlugs.map(slug => ({
    url: absoluteUrl(`/medical-review-board/${slug}`),
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.4,
  }));

  // <image:loc> requires an ABSOLUTE URL. Blog hero assets are stored as
  // site-relative paths (/blog-heroes/x.webp, served from /public); product
  // images are already absolute (Supabase storage or the /catalog CDN). GSC
  // rejects relative image locs as "Invalid URL", so normalise both forms.
  const absImage = (u: string): string => (/^https?:\/\//.test(u) ? u : absoluteUrl(u));

  const productUrls: MetadataRoute.Sitemap = products.map(p => {
    const last = p.updated_at ?? p.created_at;
    return {
      url: absoluteUrl(`/product/${p.slug}`),
      lastModified: last ? new Date(last) : now,
      changeFrequency: 'weekly',
      priority: 0.8,
      images: p.image_url ? [absImage(p.image_url)] : undefined,
    };
  });

  const blogUrls: MetadataRoute.Sitemap = posts.map(p => {
    const last = p.updated_at ?? p.date;
    return {
      url: absoluteUrl(`/blog/${p.slug}`),
      lastModified: last ? new Date(last) : now,
      changeFrequency: 'monthly',
      priority: 0.6,
      images: p.image_url ? [absImage(p.image_url)] : undefined,
    };
  });

  const pageUrls: MetadataRoute.Sitemap = pages.map(p => {
    const last = p.updated_at ?? p.created_at;
    return {
      url: absoluteUrl(`/page/${p.slug}`),
      lastModified: last ? new Date(last) : now,
      changeFrequency: 'monthly',
      priority: 0.5,
    };
  });

  return [...staticUrls, ...categoryUrls, ...brandUrls, ...tagUrls, ...collectionUrls, ...reviewerUrls, ...productUrls, ...blogUrls, ...pageUrls];
}
