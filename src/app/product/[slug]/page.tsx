export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductBySlug, supabase } from '@/lib/supabase';
import { PDPPage } from '@/sections/pdp/PDPPage';
import { ReviewsSection } from '@/components/pdp/ReviewsSection';
import { pageMeta, jsonLd, productLd, breadcrumbLd } from '@/lib/seo';
import type { ProductReview } from '@/types';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  const title = `${product.brand} ${product.name}${product.variant ? ` — ${product.variant}` : ''}`;
  const description = `Buy ${product.brand} ${product.name} in Pakistan. PKR ${product.price.toLocaleString()}. Fast COD delivery nationwide.`;
  return pageMeta({
    title,
    description,
    path: `/product/${product.slug}`,
    image: product.image_url ?? undefined,
    type: 'product',
    keywords: [product.brand, product.name, product.category, 'Pakistan', 'COD'],
  });
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [{ data: reviewRows }, { data: relatedRaw }] = await Promise.all([
    supabase
      .from('product_reviews')
      .select('id, author_name, rating, body, created_at')
      .eq('product_id', product.id)
      .eq('approved', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('*')
      .eq('category', product.category)
      .neq('id', product.id)
      .limit(8),
  ]);

  const reviews = (reviewRows ?? []) as Pick<ProductReview, 'id' | 'author_name' | 'rating' | 'body' | 'created_at'>[];
  const shuffled = (relatedRaw ?? []).sort(() => Math.random() - 0.5).slice(0, 4);

  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(productLd(product, reviews)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbLd([
            { name: 'Home',         path: '/' },
            { name: 'Shop',         path: '/shop' },
            { name: product.category, path: `/shop?cat=${encodeURIComponent(product.category)}` },
            { name: product.name,   path: `/product/${product.slug}` },
          ])),
        }}
      />
      <PDPPage product={product} relatedProducts={shuffled} />
      <ReviewsSection productId={product.id} reviews={reviews} />
    </main>
  );
}
