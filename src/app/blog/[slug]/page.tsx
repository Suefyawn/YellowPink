// ISR: cache for 1 hour; admin blog edits and catalogue writes (buy modules
// embed live product data) call revalidatePath to bust.
export const revalidate = 3600; // writes bust explicitly; long window keeps prerendered pages warm

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBlogPostBySlug, getBlogPosts, getProducts, getSiteSettings, supabase, isDemo } from '@/lib/supabase';
import { socialSameAs } from '@/lib/socials';
import { authorForName } from '@/lib/authors';
import { redirectIfMapped } from '@/lib/redirects';
import { type MedicalReviewer } from '@/lib/eeat';
import { getReviewerById } from '@/lib/reviewers';
import { isHealthCategory } from '@/lib/category-taxonomy';
import { selectRelatedProducts } from '@/lib/related-products';
import { BlogPostPage } from '@/sections/blog/BlogPostPage';
import { pageMeta, jsonLd, articleLd, breadcrumbLd } from '@/lib/seo';
import { renderContentTokens } from '@/lib/price-tokens';
import type { Product } from '@/types';

// Pre-render every blog post at build so articles are static CDN HTML (fast
// TTFB) rather than cold on-demand renders. dynamicParams stays true, so new
// posts still render on demand then cache. getBlogPosts is error-safe (returns
// [] on failure → on-demand fallback).
export async function generateStaticParams() {
  const posts = await getBlogPosts();
  return posts.map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  // Missing post → notFound(), and that returns a REAL HTTP 404: the blog
  // index's loading.tsx lives in the (index) route group so no loading
  // boundary wraps this segment — nothing streams a 200 shell before the
  // slug is resolved. (A loading.tsx here would downgrade invalid slugs to
  // soft-404s: 200 + 404-styled UI.) Posts are pre-rendered via
  // generateStaticParams, so the skeleton is not missed.
  if (!post) { await redirectIfMapped(`/blog/${slug}`); notFound(); }
  return pageMeta({
    // An admin seo_title (≤46 chars) wins over the headline — same override
    // pattern as products/brands/collections. Written for the ~148 posts whose
    // headline + brand suffix blew past Google's ~60-char display budget
    // (Semrush #102); the on-page H1 below still shows the full headline.
    title: post.seo_title?.trim() || post.title,
    description: post.excerpt ?? post.title,
    path: `/blog/${post.slug}`,
    image: post.image_url ?? undefined,
    type: 'article',
    keywords: post.category ? [post.category, 'Beauty', 'Wellness', 'Pakistan'] : undefined,
    // The post H1 is the full headline; keep the brand suffix on the <title> so
    // the two differ (Semrush "duplicate H1/title", ~113 long-title posts).
    brandSuffix: true,
  });
}

export default async function BlogPostRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, allPosts, allProducts, siteSettings] = await Promise.all([
    getBlogPostBySlug(slug),
    getBlogPosts(),
    getProducts(),
    getSiteSettings(),
  ]);
  // Unpublished/renamed post? Honour a manual redirect before 404ing.
  if (!post) { await redirectIfMapped(`/blog/${slug}`); notFound(); }

  // E-E-A-T: resolve the medical reviewer. The byline + Article reviewedBy
  // schema render whenever the post carries a Review Board credit
  // (reviewer_id). Assignment happens at insert time — a DB trigger matches
  // the post's health topic to a board doctor (default reviewer as fallback;
  // makeup posts get none) and the credited doctor is emailed — or via the
  // admin's manual assignment/reassignment, which also emails. The old
  // render-time "default board reviewer" fallback for unassigned health posts
  // is gone: a credit must be recorded on the row so it is countable,
  // reassignable, and always accompanied by the notification to the doctor.
  let reviewer: MedicalReviewer | null = null;
  if (post.reviewer_id) {
    const r = await getReviewerById(post.reviewer_id);
    reviewer = r
      ? { name: r.name, credentials: r.credentials ?? undefined, specialty: r.specialty ?? undefined, url: r.profile_url ?? undefined, profileSlug: r.slug }
      : null;
  }

  let relatedPosts = allPosts.filter(p => p.slug !== post.slug && p.category === post.category).slice(0, 3);
  // Health/YMYL guides span several categories (Wellness, Fertility, Men's /
  // Women's Health), so same-category matching alone leaves the single-guide
  // categories cross-linking to unrelated recent posts. Prefer the rest of the
  // health cluster next, so prenatal ↔ PCOS ↔ fertility ↔ male-fertility ↔
  // moringa interlink as one topical cluster (the signal Google rewards, and
  // the way to concentrate internal authority on the supplement guides).
  if (relatedPosts.length < 3 && isHealthCategory(post.category)) {
    const have = new Set([post.slug, ...relatedPosts.map(p => p.slug)]);
    const cluster = allPosts.filter(p => !have.has(p.slug) && isHealthCategory(p.category));
    relatedPosts = [...relatedPosts, ...cluster.slice(0, 3 - relatedPosts.length)];
  }
  if (relatedPosts.length < 3) {
    // Top up with other recent posts so every post links out to three others,     // keeps posts in thin categories from being near-orphaned internally
    // (SEO audit: "pages with only one internal link") and spreads more crawl
    // equity per article.
    const have = new Set([post.slug, ...relatedPosts.map(p => p.slug)]);
    relatedPosts = [...relatedPosts, ...allPosts.filter(p => !have.has(p.slug)).slice(0, 3 - relatedPosts.length)];
  }

  // Related-products matching by taxon. Blog categories ("Bone Health",
  // "Fertility Support", "Men Health", etc.) don't map 1:1 to product
  // categories ("Bone Health" is shared; "Skincare" matches; everything
  // else needs a heuristic). Wellness-ish blog category → wellness
  // taxon products; everything else → category-string contains. Always
  // fall back to a random sample from the catalog so the rail never
  // goes empty on a niche post.
  const { categoriesForTaxon } = await import('@/lib/category-taxonomy');
  const wellnessCats = categoriesForTaxon('wellness') ?? [];
  const beautyCats = [
    ...(categoriesForTaxon('makeup') ?? []),
    ...(categoriesForTaxon('skincare') ?? []),
  ];
  const blogCat = (post.category ?? '').toLowerCase();
  const isWellness = /health|wellness|fertility|sleep|immun|bone|nutrition|men |women |female/.test(blogCat);
  const isBeauty = /skin|makeup|beauty|lip|cheek|highlight|brush|foundation/.test(blogCat);
  const categoryPool: Product[] = allProducts.filter(p => {
    if (isWellness) return wellnessCats.includes(p.category);
    if (isBeauty)   return beautyCats.includes(p.category);
    return false;
  });
  // Fallback pool when the post's own category bucket is empty (a niche /
  // Uncategorized post): a few featured/bestseller products so the section
  // always has something.
  const fallbackPool = categoryPool.length > 0 ? categoryPool : allProducts.filter(p => p.is_featured || p.is_bestseller);
  // Prefer products actually named in this specific post over a flat
  // category-wide slice, see lib/related-products.ts. `mentionedInPost`
  // drives honest rail labels: only genuinely linked/named products may be
  // presented as "Recommended in this guide" / "Mentioned in This Article";
  // the generic fallback pool is labelled "More from the shop".
  const { products: relatedProducts, mentionedInPost } = selectRelatedProducts(post, allProducts, fallbackPool, 3);

  // The buy module's hero pick shows a one-line benefit, but the catalogue
  // list (PRODUCT_TILE_COLUMNS) deliberately omits long-form fields — fetch
  // short_description for just the picked products. Best-effort: on any
  // failure the module simply renders without the line.
  if (!isDemo && relatedProducts.length > 0) {
    try {
      const { data } = await supabase
        .from('products')
        .select('id, short_description')
        .in('id', relatedProducts.map(p => p.id));
      const descById = new Map(((data ?? []) as Array<{ id: string; short_description: string | null }>).map(r => [r.id, r.short_description]));
      for (const p of relatedProducts) {
        const d = descById.get(p.id);
        if (d) p.short_description = d;
      }
    } catch { /* module renders without the benefit line */ }
  }

  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // authorSameAs: only meaningful when the byline is in the AUTHORS
          // registry (the in-house editorial team → the store's own social
          // profiles); skipped for unregistered bylines.
          __html: jsonLd(articleLd(post, {
            reviewer,
            authorSameAs: authorForName(post.author) ? socialSameAs(siteSettings) : undefined,
          })),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbLd([
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blog' },
            { name: post.title, path: `/blog/${post.slug}` },
          ])),
        }}
      />
      <BlogPostPage post={{ ...post, body: renderContentTokens(post.body, allProducts) }} relatedPosts={relatedPosts} relatedProducts={relatedProducts} relatedProductsMentioned={mentionedInPost} reviewer={reviewer} catalogProducts={allProducts} />
    </main>
  );
}
