export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getProducts } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { CollectionPage } from '@/sections/collection/CollectionPage';
import { pageMeta } from '@/lib/seo';
import type { Category } from '@/types';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ category?: string; subcategory?: string; cat?: string }> }): Promise<Metadata> {
  const { category, subcategory, cat } = await searchParams;
  const resolvedCategory = category ?? cat;
  const label = subcategory ?? (resolvedCategory && resolvedCategory !== 'All' ? resolvedCategory : null);
  const title = label ? `${label} — Shop` : 'Shop All Products';
  const params = new URLSearchParams();
  if (resolvedCategory && resolvedCategory !== 'All') params.set('category', resolvedCategory);
  if (subcategory) params.set('subcategory', subcategory);
  const qs = params.toString();
  return pageMeta({
    title,
    description: 'Browse imported skincare, makeup, and wellness products. COD available nationwide in Pakistan.',
    path: `/shop${qs ? `?${qs}` : ''}`,
  });
}

async function loadCategories(): Promise<Category[]> {
  // All categories; CollectionPage groups by parent_id client-side.
  const { data } = await supabase
    .from('categories')
    .select('id, parent_id, slug, name, description, image_url, sort_order, wp_term_id')
    .order('sort_order')
    .order('name');
  return (data ?? []) as Category[];
}

async function resolveCategoryFromSlug(slug: string | undefined, categories: Category[]): Promise<string | null> {
  if (!slug) return null;
  const hit = categories.find(c => c.slug.toLowerCase() === slug.toLowerCase());
  return hit?.name ?? null;
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string; subcategory?: string; cat?: string }> }) {
  const [products, categories] = await Promise.all([getProducts(), loadCategories()]);
  const { category, subcategory, cat } = await searchParams;

  // Resolve ?cat=<slug> (used by WP redirects) into a display category name.
  const initialCategory =
    category ??
    (cat ? (await resolveCategoryFromSlug(cat, categories)) ?? cat : 'All');

  return (
    <main className="fade-in">
      <CollectionPage
        products={products}
        categories={categories}
        initialCategory={initialCategory}
        initialSubcategory={subcategory ?? null}
      />
    </main>
  );
}
