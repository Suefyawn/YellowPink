// ============================================================================
// Collections, types + membership resolution.
//
// A collection groups products for a /collection/[slug] landing page. Manual
// collections list products explicitly (ordered); smart collections evaluate a
// rule set against the catalogue so membership stays current. The resolver here
// is pure so it can run on the storefront page and be unit-tested.
// ============================================================================

import type { Product } from '@/types';

export type CollectionType = 'manual' | 'smart';

export interface SmartCondition {
  field: 'title' | 'tag' | 'brand' | 'category' | 'price' | 'stock' | 'on_sale' | 'featured' | 'bestseller' | 'packaging';
  /** 'in' = exact membership (text fields); 'contains' / 'not_contains' =
   *  case-insensitive substring on text fields (Shopify's "contains" /
   *  "does not contain"); 'lte' / 'gte' compare numeric fields; 'is' is the
   *  boolean flags' only op. */
  op: 'in' | 'contains' | 'not_contains' | 'lte' | 'gte' | 'is';
  value: string[] | string | number | boolean;
}

export interface SmartRules {
  match?: 'all' | 'any';
  conditions?: SmartCondition[];
}

export interface Collection {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  hero_image_url: string | null;
  type: CollectionType;
  rules: SmartRules;
  status: 'published' | 'draft';
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  /** Long-form HTML rendered under the product grid (staff-authored). */
  content_html?: string | null;
  /** FAQ entries rendered on the page and emitted as FAQPage JSON-LD. */
  faqs?: { q: string; a: string }[] | null;
}

/** Case-insensitive substring test for the contains / does-not-contain ops.
 *  An empty needle matches nothing (a half-typed rule shouldn't catch the
 *  whole shop); a null field counts as the empty string, so "does not
 *  contain" is satisfied by products with no value at all. */
function containsMatch(haystack: string | null | undefined, c: SmartCondition): boolean {
  const needle = typeof c.value === 'string' ? c.value.trim().toLowerCase() : '';
  if (!needle) return false;
  const hit = (haystack ?? '').toLowerCase().includes(needle);
  return c.op === 'not_contains' ? !hit : hit;
}

function matchCondition(p: Product, c: SmartCondition, productTags: string[]): boolean {
  const isContainsOp = c.op === 'contains' || c.op === 'not_contains';
  switch (c.field) {
    case 'title':    return containsMatch(p.name, c);
    case 'tag':
      if (isContainsOp) {
        const needle = typeof c.value === 'string' ? c.value.trim().toLowerCase() : '';
        if (!needle) return false;
        const hit = productTags.some(t => t.toLowerCase().includes(needle));
        return c.op === 'not_contains' ? !hit : hit;
      }
      return Array.isArray(c.value) && c.value.some(v => productTags.includes(String(v)));
    case 'brand':
      if (isContainsOp) return containsMatch(p.brand, c);
      return Array.isArray(c.value) && !!p.brand && c.value.map(String).includes(p.brand);
    case 'category':
      if (isContainsOp) return containsMatch(p.category, c);
      return Array.isArray(c.value) && !!p.category && c.value.map(String).includes(p.category);
    case 'packaging': return Array.isArray(c.value) && !!p.packaging && c.value.map(String).includes(p.packaging);
    case 'price':
      if (typeof c.value !== 'number') return false;
      return c.op === 'gte' ? p.price >= c.value : p.price <= c.value;
    case 'stock':
      if (typeof c.value !== 'number') return false;
      return c.op === 'gte' ? (p.stock ?? 0) >= c.value : (p.stock ?? 0) <= c.value;
    case 'on_sale':    return !!(p.original_price && p.original_price > p.price);
    case 'featured':   return !!p.is_featured;
    case 'bestseller': return !!p.is_bestseller;
    default:           return false;
  }
}

/** True when a product satisfies a smart collection's rule set. An empty rule
 *  set matches nothing (so a half-built smart collection isn't the whole shop). */
export function productMatchesRules(p: Product, rules: SmartRules, productTags: string[]): boolean {
  const conds = rules.conditions ?? [];
  if (conds.length === 0) return false;
  const results = conds.map(c => matchCondition(p, c, productTags));
  return (rules.match ?? 'all') === 'any' ? results.some(Boolean) : results.every(Boolean);
}

/** Ordered product list for a collection.
 *  - manual: the products in `manualOrder` (by their stored position).
 *  - smart:  catalogue products matching the rules, best sellers first.
 *
 * Smart membership used to keep the caller's order, which in practice was the
 * catalogue query's `.order('id')` — i.e. random UUID order on the landing
 * page. Sales signal first, then newest, is the Shopify default for automated
 * collections and matches what the shop browser calls "Best selling". */
export function resolveCollectionProducts(
  collection: Pick<Collection, 'type' | 'rules'>,
  products: Product[],
  opts: { manualOrder?: Map<string, number>; productTagMap?: Record<string, string[]> } = {},
): Product[] {
  if (collection.type === 'manual') {
    const order = opts.manualOrder ?? new Map<string, number>();
    return products
      .filter(p => order.has(p.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }
  const tagMap = opts.productTagMap ?? {};
  return products
    .filter(p => productMatchesRules(p, collection.rules, tagMap[p.id] ?? []))
    .sort((a, b) =>
      (b.sales_score ?? 0) - (a.sales_score ?? 0)
      || (b.units_sold ?? 0) - (a.units_sold ?? 0)
      || (b.created_at ?? '').localeCompare(a.created_at ?? ''),
    );
}
