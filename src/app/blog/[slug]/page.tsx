// ISR: cache for 10 min; admin blog edits call revalidatePath to bust.
export const revalidate = 600;

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBlogPostBySlug, getBlogPosts, getProducts, getSiteSettings } from '@/lib/supabase';
import { medicalReviewer } from '@/lib/eeat';
import { isHealthCategory } from '@/lib/category-taxonomy';
import { BlogPostPage } from '@/sections/blog/BlogPostPage';
import { pageMeta, jsonLd, articleLd, breadcrumbLd } from '@/lib/seo';
import type { Product } from '@/types';

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
  const [post, allPosts, allProducts, settings] = await Promise.all([
    getBlogPostBySlug(slug),
    getBlogPosts(),
    getProducts(),
    getSiteSettings(),
  ]);
  if (!post) notFound();

  // E-E-A-T: surface the store's medical reviewer on YMYL health posts only
  // (same gate as the medical disclaimer). null on beauty posts or when no
  // reviewer is configured — the byline + schema then simply omit it.
  const reviewer = isHealthCategory(post.category) ? medicalReviewer(settings) : null;

  let relatedPosts = allPosts.filter(p => p.slug !== post.slug && p.category === post.category).slice(0, 3);
  if (relatedPosts.length < 3) {
    // Top up with other recent posts so every post links out to three others —
    // keeps posts in thin categories from being near-orphaned internally
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
  let relatedProducts: Product[] = allProducts.filter(p => {
    if (isWellness) return wellnessCats.includes(p.category);
    if (isBeauty)   return beautyCats.includes(p.category);
    return false;
  }).slice(0, 3);
  if (relatedProducts.length === 0) {
    // Fallback: a few featured/bestseller products so the section
    // always has something on niche / Uncategorized posts.
    relatedProducts = allProducts
      .filter(p => p.is_featured || p.is_bestseller)
      .slice(0, 3);
  }

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
