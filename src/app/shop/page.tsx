export const dynamic = 'force-dynamic';

import { getProducts } from '@/lib/supabase';
import { CollectionPage } from '@/sections/collection/CollectionPage';

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const products = await getProducts();
  const { category } = await searchParams;
  return (
    <main className="fade-in">
      <CollectionPage products={products} initialCategory={category ?? 'All'} />
    </main>
  );
}
