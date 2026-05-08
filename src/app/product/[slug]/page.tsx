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

  const [{ data: reviews }, { data: relatedRaw }] = await Promise.all([
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

  // Shuffle and take 4 so "Pairs With" doesn't always show the same products
  const shuffled = (relatedRaw ?? []).sort(() => Math.random() - 0.5).slice(0, 4);

  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": `${product.brand} ${product.name}${product.variant ? ` ${product.variant}` : ''}`,
            "description": product.description ?? undefined,
            "image": product.image_url ?? undefined,
            "brand": { "@type": "Brand", "name": product.brand },
            "offers": {
              "@type": "Offer",
              "priceCurrency": "PKR",
              "price": product.price,
              "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              "seller": { "@type": "Organization", "name": "Yellow Pink" }
            }
          })
        }}
      />
      <PDPPage product={product} relatedProducts={shuffled} />
      <ReviewsSection productId={product.id} reviews={reviews ?? []} />
    </main>
  );
}
