export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getProducts } from '@/lib/supabase';
import { CollectionPage } from '@/sections/collection/CollectionPage';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ category?: string }> }): Promise<Metadata> {
  const { category } = await searchParams;
  const title = category && category !== 'All'
    ? `${category} — Shop | Yellow Pink`
    : 'Shop All Products | Yellow Pink';
  const canonical = category && category !== 'All'
    ? `https://yellow-pink.vercel.app/shop?category=${encodeURIComponent(category)}`
    : 'https://yellow-pink.vercel.app/shop';
  return {
    title,
    description: 'Browse imported skincare, makeup, and wellness products. COD available nationwide in Pakistan.',
    openGraph: { title, description: 'Shop imported beauty & wellness. COD Pakistan.' },
    alternates: { canonical },
  };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const products = await getProducts();
  const { category } = await searchParams;
  return (
    <main className="fade-in">
      <CollectionPage products={products} initialCategory={category ?? 'All'} />
    </main>
  );
}
