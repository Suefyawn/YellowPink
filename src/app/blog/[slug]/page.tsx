export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBlogPostBySlug, getBlogPosts, getProducts } from '@/lib/supabase';
import { BlogPostPage } from '@/sections/blog/BlogPostPage';
import type { Product } from '@/types';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return {};
  const title = `${post.title} | Yellow Pink Blog`;
  return {
    title,
    description: post.excerpt ?? post.title,
    openGraph: {
      title,
      description: post.excerpt ?? post.title,
      type: 'article',
      images: post.image_url ? [{ url: post.image_url }] : [],
    },
  };
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
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": post.title,
            "description": post.excerpt,
            "image": post.image_url ?? undefined,
            "datePublished": post.date,
            "publisher": { "@type": "Organization", "name": "Yellow Pink", "url": "https://yellowpink.pk" }
          })
        }}
      />
      <BlogPostPage post={post} relatedPosts={relatedPosts} relatedProducts={relatedProducts} />
    </main>
  );
}
