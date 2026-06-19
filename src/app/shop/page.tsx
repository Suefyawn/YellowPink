// 5-min ISR. Search/filter params still bypass the cache because Next keys
// the ISR slot on (path + searchParams). Was `force-dynamic` before the
// 2026-05-24 audit.
export const revalidate = 300;

import type { Metadata } from 'next';
import { getProducts, isDemo } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { CollectionPage } from '@/sections/collection/CollectionPage';
import { pageMeta, jsonLd, breadcrumbLd, itemListLd } from '@/lib/seo';
import { canonicalCategory, CATEGORY_DESCRIPTIONS } from '@/lib/category-taxonomy';
import type { ProductAttribute, AttributeValue } from '@/types';

export interface AttributeWithValues extends ProductAttribute {
  values: AttributeValue[];
}

interface FacetData {
  attributes: AttributeWithValues[];
  productValueMap: Record<string, string[]>;     // product_id → attribute_value_ids
}

export interface TagFacet { slug: string; name: string }

interface TagData {
  productTagMap: Record<string, string[]>;       // product_id → tag slugs
  allTags: TagFacet[];                           // full tag vocabulary (slug + display name)
}

// Tags power the storefront Tags facet. product_tags + product_tag_map are
// anon-readable (migration 143); the catalogue is small so one round-trip is
// plenty. Demo mode has no tag tables, so short-circuit.
async function loadTagData(): Promise<TagData> {
  if (isDemo) return { productTagMap: {}, allTags: [] };
  const [{ data: tagRows }, { data: mapRows }] = await Promise.all([
    supabase.from('product_tags').select('id, slug, name').order('name'),
    supabase.from('product_tag_map').select('product_id, tag_id'),
  ]);
  const slugById = new Map<string, string>();
  const allTags: TagFacet[] = [];
  for (const t of (tagRows ?? []) as Array<{ id: string; slug: string; name: string }>) {
    slugById.set(t.id, t.slug);
    allTags.push({ slug: t.slug, name: t.name });
  }
  const productTagMap: Record<string, string[]> = {};
  for (const r of (mapRows ?? []) as Array<{ product_id: string; tag_id: string }>) {
    const slug = slugById.get(r.tag_id);
    if (!slug) continue;
    (productTagMap[r.product_id] ??= []).push(slug);
  }
  return { productTagMap, allTags };
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

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ category?: string; subcategory?: string; cat?: string; q?: string; brand?: string }> }): Promise<Metadata> {
  const { category, subcategory, cat, q, brand } = await searchParams;
  // Resolve ?category= (or the legacy ?cat=) to its canonical label, so the
  // slug form (?category=combo-packs) and the label form (?category=Combo
  // Packs) collapse onto ONE title + canonical URL instead of two duplicates.
  const resolvedCategory = canonicalCategory(category ?? cat);
  // ?subcategory= is always a leaf category, so it gets the SAME slug-or-label
  // normalisation — otherwise ?subcategory=combo-packs and ?subcategory=Combo
  // Packs would render two different titles + canonicals for the same page.
  const resolvedSubcategory = canonicalCategory(subcategory);
  // Sanitise free-text params before interpolating them into the title /
  // description / og:title (audit SEV-2: raw `<img onerror=…>` once ended up
  // in the og:title `content` attribute). Strip every character with
  // structural meaning in HTML and clamp length.
  const clean = (s: string | undefined, max: number) =>
    s?.trim() ? s.trim().replace(/[<>"'&]/g, '').slice(0, max) : '';
  const trimmedQ = clean(q, 80);
  const trimmedBrand = clean(brand, 60);
  // Title: query > subcategory > category > brand > generic. Each variant
  // gets a distinct, human-readable title (good for SERPs).
  let title: string;
  if (trimmedQ)                 title = `Search: ${trimmedQ}`;
  else if (resolvedSubcategory) title = `${resolvedSubcategory} — Shop`;
  else if (resolvedCategory)    title = `${resolvedCategory} — Shop`;
  else if (trimmedBrand)        title = `${trimmedBrand} — Shop`;
  else                          title = 'Shop All Products';

  // Canonical strategy:
  //   • `/shop`, `/shop?category=Foo` (`?subcategory=Bar`) and a pure
  //     `/shop?brand=Baz` are real index targets — each canonicalizes to
  //     itself, with the category in its canonical label form.
  //   • Free-text searches, attr/price/stock filters, sort, pagination, and
  //     brand+category combos are variations of the same set — they
  //     canonicalize back to `/shop` (or the matching category root), so
  //     Google never indexes every brand×category permutation.
  const canonicalParams = new URLSearchParams();
  if (resolvedCategory) canonicalParams.set('category', resolvedCategory);
  if (resolvedSubcategory) canonicalParams.set('subcategory', resolvedSubcategory);
  if (trimmedBrand && !resolvedCategory && !resolvedSubcategory) canonicalParams.set('brand', trimmedBrand);
  const qs = canonicalParams.toString();

  // Description: search > subcategory copy > category landing copy > brand
  // line > generic. Every category, subcategory and brand page gets its OWN
  // description rather than silently inheriting its parent taxon's.
  let description: string;
  if (trimmedQ) {
    description = `Search results for "${trimmedQ}" — imported skincare, makeup, and wellness products. COD nationwide in Pakistan.`;
  } else if (resolvedSubcategory && CATEGORY_DESCRIPTIONS[resolvedSubcategory]) {
    description = CATEGORY_DESCRIPTIONS[resolvedSubcategory];
  } else if (resolvedCategory && CATEGORY_DESCRIPTIONS[resolvedCategory]) {
    description = CATEGORY_DESCRIPTIONS[resolvedCategory];
  } else if (trimmedBrand) {
    description = `Shop the ${trimmedBrand} range at Yellow Pink — 100% authentic, imported ${trimmedBrand}, with cash-on-delivery nationwide in Pakistan.`;
  } else {
    description = 'Browse imported skincare, makeup, and wellness products. COD available nationwide in Pakistan.';
  }

  return pageMeta({
    title,
    description,
    path: `/shop${qs ? `?${qs}` : ''}`,
    // Block free-text searches from being indexed (they're infinite-state).
    noIndex: Boolean(trimmedQ),
  });
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string; subcategory?: string; cat?: string; taxon?: string; on_sale?: string; q?: string; brand?: string; tag?: string; featured?: string; bestseller?: string }> }) {
  const [products, facetData, tagData] = await Promise.all([
    getProducts(),
    loadFacetData(),
    loadTagData(),
  ]);
  const { category, subcategory, cat, taxon, on_sale, q, brand, tag: tagParam, featured, bestseller } = await searchParams;
  const searchParamsFeatured = featured === '1';
  const searchParamsBestseller = bestseller === '1';

  // ?category= is canonical; ?cat= is a legacy WP param the proxy already
  // 301s across. CollectionPage resolves the value (taxon or leaf) itself.
  const initialCategory = category ?? cat ?? 'All';

  // Resolve ?taxon=makeup into the macro-bucket category set so the
  // CollectionPage can multi-filter. We resolve here so the server-rendered
  // header reflects the right active category from the first paint.
  const { findTaxon } = await import('@/lib/category-taxonomy');
  const taxonObj = findTaxon(taxon);

  // Scope the JSON-LD ItemList to whatever the URL implies — taxon →
  // products in those categories, single category → that category, else
  // top of the catalog. We cap at 24 to keep the schema lean.
  const scopedProducts = taxonObj
    ? products.filter(p => taxonObj.categories.includes(p.category)).slice(0, 24)
    : initialCategory !== 'All'
      ? products.filter(p => p.category === initialCategory).slice(0, 24)
      : products.slice(0, 24);

  const breadcrumb = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    ...(taxonObj ? [{ name: taxonObj.label, path: `/shop?taxon=${taxonObj.key}` }] : []),
    ...(initialCategory !== 'All' && !taxonObj
      ? [{ name: initialCategory, path: `/shop?category=${encodeURIComponent(initialCategory)}` }]
      : []),
  ];

  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd(breadcrumb)) }}
      />
      {/* Only emit the ItemList when it actually has items. Taxon-level
          category labels (e.g. ?category=Skincare) have no exact leaf-category
          match server-side, which otherwise produced an empty ItemList — a
          structured-data markup error flagged by SEO audits. */}
      {scopedProducts.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(itemListLd(
              taxonObj?.label ?? (initialCategory !== 'All' ? initialCategory : 'All products'),
              scopedProducts.map(p => ({
                name: p.name,
                path: `/product/${p.slug}`,
              })),
            )),
          }}
        />
      )}
      {/* `key` on the destination params remounts CollectionPage on a genuine
          listing change — switching taxon/category/subcategory, a ?q= search,
          or ?on_sale=1 — so its URL-seeded state re-initialises. Client-side
          navigation between two /shop?… URLs otherwise reuses the instance and
          leaves the view stale until a hard refresh. The component writes its
          OWN filter params (brand/price/sort/page) which are deliberately NOT
          in this key, so applying filters never triggers a remount. */}
      <CollectionPage
        key={`${taxon ?? ''}|${initialCategory}|${subcategory ?? ''}|${q ?? ''}|${on_sale ?? ''}`}
        products={products}
        attributes={facetData.attributes}
        productValueMap={facetData.productValueMap}
        productTagMap={tagData.productTagMap}
        allTags={tagData.allTags}
        initialCategory={initialCategory}
        initialSubcategory={subcategory ?? null}
        initialOnSaleOnly={on_sale === '1'}
        initialBrand={brand ?? null}
        initialTags={tagParam ?? null}
        initialFeatured={searchParamsFeatured}
        initialBestseller={searchParamsBestseller}
      />
    </main>
  );
}
