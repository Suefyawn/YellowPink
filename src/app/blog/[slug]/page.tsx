// ISR: cache for 10 min; admin blog edits call revalidatePath to bust.
export const revalidate = 600;

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBlogPostBySlug, getBlogPosts, getProducts } from '@/lib/supabase';
import { redirectIfMapped } from '@/lib/redirects';
import { type MedicalReviewer } from '@/lib/eeat';
import { getReviewerById, getActiveReviewers } from '@/lib/reviewers';
import { isHealthCategory } from '@/lib/category-taxonomy';
import { selectRelatedProducts } from '@/lib/related-products';
import { BlogPostPage } from '@/sections/blog/BlogPostPage';
import { pageMeta, jsonLd, articleLd, breadcrumbLd } from '@/lib/seo';
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
  // Missing post → notFound(). Note: the blog segment has a loading.tsx
  // skeleton, so an invalid slug streams a 200 shell first → soft-404 (200 +
  // noindex'd not-found UI) rather than a hard 404. Accepted trade-off; the
  // page is noindexed and such URLs aren't linked/sitemapped.
  if (!post) notFound();
  return pageMeta({
    title: post.title,
    description: post.excerpt ?? post.title,
    path: `/blog/${post.slug}`,
    image: post.image_url ?? undefined,
    type: 'article',
    keywords: post.category ? [post.category, 'Beauty', 'Wellness', 'Pakistan'] : undefined,
  });
}

export default async function BlogPostRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, allPosts, allProducts] = await Promise.all([
    getBlogPostBySlug(slug),
    getBlogPosts(),
    getProducts(),
  ]);
  // Unpublished/renamed post? Honour a manual redirect before 404ing.
  if (!post) { await redirectIfMapped(`/blog/${slug}`); notFound(); }

  // E-E-A-T: resolve the medical reviewer. An explicit per-post Review Board
  // assignment always wins and always shows, even on a post whose category
  // isn't auto-classified as health (e.g. a minoxidil piece filed under
  // "Hair"), that's exactly the admin saying "this needs a doctor's name". The
  // default board reviewer is only used as a fallback on health-category posts
  // that haven't been assigned one. null otherwise. (The Medical Review Board
  // is the single source of truth; the legacy store-wide setting was retired.)
  let reviewer: MedicalReviewer | null = null;
  {
    const pid = (post as { reviewer_id?: string | null }).reviewer_id;
    let r = pid ? await getReviewerById(pid) : null;
    if (!r && isHealthCategory(post.category)) {
      r = (await getActiveReviewers()).find(x => x.is_default) ?? null;
    }
    reviewer = r
      ? { name: r.name, credentials: r.credentials ?? undefined, specialty: r.specialty ?? undefined, url: r.profile_url ?? undefined, profileSlug: r.slug }
      : null;
  }

  let relatedPosts = allPosts.filter(p => p.slug !== post.slug && p.category === post.category).slice(0, 3);
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
  // category-wide slice, see lib/related-products.ts.
  const relatedProducts = selectRelatedProducts(post, allProducts, fallbackPool, 3);

  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(articleLd(post, { reviewer })) }}
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
      <BlogPostPage post={post} relatedPosts={relatedPosts} relatedProducts={relatedProducts} reviewer={reviewer} />
    </main>
  );
}
