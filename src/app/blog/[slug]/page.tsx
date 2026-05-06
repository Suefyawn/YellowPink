export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getBlogPostBySlug, getBlogPosts, getProducts } from '@/lib/supabase';
import { BlogPostPage } from '@/sections/blog/BlogPostPage';
import type { Product } from '@/types';

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
    if (post.category === 'Skincare') return ['Skincare', 'Sunscreen'].includes(p.category);
    return ['Lip Tints', 'Blush', 'Foundations', 'Concealers', 'Highlighters'].includes(p.category);
  }).slice(0, 3);

  return (
    <main className="fade-in">
      <BlogPostPage post={post} relatedPosts={relatedPosts} relatedProducts={relatedProducts} />
    </main>
  );
}
