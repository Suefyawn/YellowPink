export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductBySlug, supabase } from '@/lib/supabase';
import { PDPPage } from '@/sections/pdp/PDPPage';
import { ReviewsSection } from '@/components/pdp/ReviewsSection';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  const title = `${product.brand} ${product.name}${product.variant ? ` — ${product.variant}` : ''} | Yellow Pink`;
  const description = `Buy ${product.brand} ${product.name} in Pakistan. PKR ${product.price.toLocaleString()}. Fast COD delivery nationwide.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: product.image_url ? [{ url: product.image_url }] : [],
      type: 'website',
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const { data: reviews } = await supabase
    .from('product_reviews')
    .select('id, author_name, rating, body, created_at')
    .eq('product_id', product.id)
    .eq('approved', true)
    .order('created_at', { ascending: false });

  return (
    <main className="fade-in">
      <PDPPage product={product} />
      <ReviewsSection productId={product.id} reviews={reviews ?? []} />
    </main>
  );
}
