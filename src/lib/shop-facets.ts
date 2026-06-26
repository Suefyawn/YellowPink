// ============================================================================
// Shared shop facet loaders.
//
// Used by /shop and the /brand/[slug] + /tag/[slug] archive pages so they all
// render the same filter rail (variant attributes + tags). Kept server-only, // these read Supabase directly.
// ============================================================================

import { supabase, isDemo } from '@/lib/supabase';
import type { ProductAttribute, AttributeValue } from '@/types';

export interface AttributeWithValues extends ProductAttribute {
  values: AttributeValue[];
}

export interface FacetData {
  attributes: AttributeWithValues[];
  productValueMap: Record<string, string[]>;     // product_id → attribute_value_ids
}

export interface TagFacet { slug: string; name: string }

export interface TagData {
  productTagMap: Record<string, string[]>;       // product_id → tag slugs
  allTags: TagFacet[];                           // full tag vocabulary (slug + display name)
}

export async function loadFacetData(): Promise<FacetData> {
  // Demo-mode short-circuit: no variants in stub data, no facets.
  if (isDemo) return { attributes: [], productValueMap: {} };
  // Pull every active variant + its option links, joined with the value +
  // attribute metadata. One round-trip; data is small (one row per
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

  const usedValueIds = new Set(Object.values(productValueMap).flat());
  const attributes: AttributeWithValues[] = ((attrRows ?? []) as ProductAttribute[])
    .map(a => ({
      ...a,
      values: ((valRows ?? []) as AttributeValue[]).filter(v => v.attribute_id === a.id && usedValueIds.has(v.id)),
    }))
    .filter(a => a.values.length > 0);

  return { attributes, productValueMap };
}

// Tags power the storefront Tags facet. product_tags + product_tag_map are
// anon-readable (migration 143); the catalogue is small so one round-trip is
// plenty. Demo mode has no tag tables, so short-circuit.
export async function loadTagData(): Promise<TagData> {
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
