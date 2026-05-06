export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductBySlug } from '@/lib/supabase';
import { PDPPage } from '@/sections/pdp/PDPPage';

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
  return (
    <main className="fade-in">
      <PDPPage product={product} />
    </main>
  );
}
