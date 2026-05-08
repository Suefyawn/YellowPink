export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getProducts } from '@/lib/supabase';
import { CollectionPage } from '@/sections/collection/CollectionPage';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ category?: string; subcategory?: string }> }): Promise<Metadata> {
  const { category, subcategory } = await searchParams;
  const label = subcategory ?? (category && category !== 'All' ? category : null);
  const title = label ? `${label} — Shop | Yellow Pink` : 'Shop All Products | Yellow Pink';
  const params = new URLSearchParams();
  if (category && category !== 'All') params.set('category', category);
  if (subcategory) params.set('subcategory', subcategory);
  const qs = params.toString();
  const canonical = `https://yellow-pink.vercel.app/shop${qs ? `?${qs}` : ''}`;
  return {
    title,
    description: 'Browse imported skincare, makeup, and wellness products. COD available nationwide in Pakistan.',
    openGraph: { title, description: 'Shop imported beauty & wellness. COD Pakistan.' },
    alternates: { canonical },
  };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string; subcategory?: string }> }) {
  const products = await getProducts();
  const { category, subcategory } = await searchParams;
  return (
    <main className="fade-in">
      <CollectionPage
        products={products}
        initialCategory={category ?? 'All'}
        initialSubcategory={subcategory ?? null}
      />
    </main>
  );
}
