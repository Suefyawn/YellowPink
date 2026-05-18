// ISR: cache for 10 min; admin blog edits call revalidatePath to bust.
export const revalidate = 600;

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBlogPostBySlug, getBlogPosts, getProducts } from '@/lib/supabase';
import { BlogPostPage } from '@/sections/blog/BlogPostPage';
import { pageMeta, jsonLd, articleLd, breadcrumbLd } from '@/lib/seo';
import type { Product } from '@/types';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return {};
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
  if (!post) notFound();

  const relatedPosts = allPosts.filter(p => p.slug !== post.slug && p.category === post.category).slice(0, 2);
  const relatedProducts: Product[] = allProducts.filter(p => {
    if (post.category === 'Wellness') return p.category === 'Wellness';
    if (post.category === 'Skincare') return p.category === 'Skincare';
    return p.category === 'Makeup';
  }).slice(0, 3);

  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(articleLd(post)) }}
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
      <BlogPostPage post={post} relatedPosts={relatedPosts} relatedProducts={relatedProducts} />
    </main>
  );
}
