// 5-min ISR. Search/filter params still bypass the cache because Next keys
// the ISR slot on (path + searchParams). Was `force-dynamic` before the
// 2026-05-24 audit.
export const revalidate = 300;

import type { Metadata } from 'next';
import { getProducts, isDemo } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { DEMO_CATEGORIES } from '@/lib/demo-data';
import { CollectionPage } from '@/sections/collection/CollectionPage';
import { pageMeta } from '@/lib/seo';
import type { Category, ProductAttribute, AttributeValue } from '@/types';

export interface AttributeWithValues extends ProductAttribute {
  values: AttributeValue[];
}

interface FacetData {
  attributes: AttributeWithValues[];
  productValueMap: Record<string, string[]>;     // product_id → attribute_value_ids
}

async function loadFacetData(): Promise<FacetData> {
  // Demo-mode short-circuit: no variants in stub data, no facets.
  if (isDemo) return { attributes: [], productValueMap: {} };
  // Pull every active variant + its option links, joined with the value + attribute
  // metadata. This is one round-trip; data is small enough (one row per
  // variant-value pair across the active catalog).
  const [{ data: vavRows }, { data: attrRows }, { data: valRows }] = await Promise.all([
    supabase
      .from('variant_attribute_values')
      .select('attribute_value_id, variant:product_variants!inner(product_id, enabled)')
      .eq('variant.enabled', true),
    supabase.from('product_attributes')
      .select('id, slug, name, visible_on_pdp, usable_in_filter, sort_order')
      .eq('usable_in_filter', true)
      .order('sort_order'),
    supabase.from('attribute_values')
      .select('id, attribute_id, slug, value, color_hex, image_url, sort_order')
      .order('sort_order'),
  ]);

  // Bucket value ids per product id. Supabase types the nested relation as
  // an array even when it's a 1:1 — destructure defensively.
  const productValueMap: Record<string, string[]> = {};
  const rows = (vavRows ?? []) as unknown as Array<{
    attribute_value_id: string;
    variant: { product_id: string } | { product_id: string }[] | null;
  }>;
  for (const row of rows) {
    const v = Array.isArray(row.variant) ? row.variant[0] : row.variant;
    const productId = v?.product_id;
    if (!productId) continue;
    const arr = productValueMap[productId] ?? [];
    if (!arr.includes(row.attribute_value_id)) arr.push(row.attribute_value_id);
    productValueMap[productId] = arr;
  }

  // Only show attributes that have at least one referenced value.
  const usedValueIds = new Set(Object.values(productValueMap).flat());
  const attributes: AttributeWithValues[] = ((attrRows ?? []) as ProductAttribute[])
    .map(a => ({
      ...a,
      values: ((valRows ?? []) as AttributeValue[]).filter(v => v.attribute_id === a.id && usedValueIds.has(v.id)),
    }))
    .filter(a => a.values.length > 0);

  return { attributes, productValueMap };
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ category?: string; subcategory?: string; cat?: string; q?: string }> }): Promise<Metadata> {
  const { category, subcategory, cat, q } = await searchParams;
  const resolvedCategory = category ?? cat;
  // Sanitise free-text query before interpolating it into the title /
  // description / og:title (audit SEV-2: raw `<img onerror=…>` ended up in
  // og:title `content` attribute when query was malicious). Strip every
  // character that has structural meaning in HTML and clamp length.
  const rawQ = q?.trim() ?? '';
  const trimmedQ = rawQ ? rawQ.replace(/[<>"'&]/g, '').slice(0, 80) : '';
  // Title: query > category > generic. Each variant gets a distinct,
  // human-readable title (good for SERPs).
  let title: string;
  if (trimmedQ)              title = `Search: ${trimmedQ}`;
  else if (subcategory)      title = `${subcategory} — Shop`;
  else if (resolvedCategory && resolvedCategory !== 'All') title = `${resolvedCategory} — Shop`;
  else                        title = 'Shop All Products';

  // Canonical strategy:
  //   • `/shop` (no params) and `/shop?category=Foo` (or `/shop?subcategory=Bar`)
  //     are real index targets — each canonicalizes to itself.
  //   • Free-text searches, brand/attr/price/stock filters, sort, and
  //     pagination are all variations of the same product set — they
  //     canonicalize back to `/shop` (or the matching category root).
  //     Keeps Google from indexing thousands of near-duplicate URLs.
  const canonicalParams = new URLSearchParams();
  if (resolvedCategory && resolvedCategory !== 'All') canonicalParams.set('category', resolvedCategory);
  if (subcategory) canonicalParams.set('subcategory', subcategory);
  const qs = canonicalParams.toString();

  return pageMeta({
    title,
    description: trimmedQ
      ? `Search results for "${trimmedQ}" — imported skincare, makeup, and wellness products. COD nationwide in Pakistan.`
      : 'Browse imported skincare, makeup, and wellness products. COD available nationwide in Pakistan.',
    path: `/shop${qs ? `?${qs}` : ''}`,
    // Block free-text searches from being indexed (they're infinite-state).
    noIndex: Boolean(trimmedQ),
  });
}

async function loadCategories(): Promise<Category[]> {
  if (isDemo) return DEMO_CATEGORIES;
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

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string; subcategory?: string; cat?: string; taxon?: string; on_sale?: string }> }) {
  const [products, categories, facetData] = await Promise.all([
    getProducts(),
    loadCategories(),
    loadFacetData(),
  ]);
  const { category, subcategory, cat, taxon, on_sale } = await searchParams;

  // Resolve ?cat=<slug> (used by WP redirects) into a display category name.
  const initialCategory =
    category ??
    (cat ? (await resolveCategoryFromSlug(cat, categories)) ?? cat : 'All');

  // Resolve ?taxon=makeup into the macro-bucket category set so the
  // CollectionPage can multi-filter. We resolve here so the server-rendered
  // header reflects the right active category from the first paint.
  const { findTaxon } = await import('@/lib/category-taxonomy');
  const taxonObj = findTaxon(taxon);

  return (
    <main className="fade-in">
      <CollectionPage
        products={products}
        categories={categories}
        attributes={facetData.attributes}
        productValueMap={facetData.productValueMap}
        initialCategory={initialCategory}
        initialSubcategory={subcategory ?? null}
        initialTaxon={taxonObj?.key ?? null}
        initialTaxonCategories={taxonObj ? [...taxonObj.categories] : null}
        initialOnSaleOnly={on_sale === '1'}
      />
    </main>
  );
}
