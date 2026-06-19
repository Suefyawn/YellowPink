// ============================================================================
// Brand helpers.
//
// There is no brands table — a brand is just the distinct `products.brand`
// string. These helpers slugify a brand for /brand/[slug] URLs and resolve a
// slug back to its canonical brand string, plus build the brand directory.
// ============================================================================

import type { Product } from '@/types';

/** URL-safe slug for a brand name. "Beauty of Joseon" → "beauty-of-joseon". */
export function brandSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export interface BrandSummary { name: string; slug: string; count: number }

/** Brand list (name, slug, product count) from a product set, sorted A→Z.
 *  Only counts the products the caller passes in (already visibility-filtered). */
export function brandsFromProducts(products: Pick<Product, 'brand'>[]): BrandSummary[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    if (!p.brand) continue;
    counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, slug: brandSlug(name), count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolve a /brand/[slug] segment back to the exact brand string (or null). */
export function brandNameFromSlug(slug: string, products: Pick<Product, 'brand'>[]): string | null {
  const want = slug.toLowerCase();
  for (const p of products) {
    if (p.brand && brandSlug(p.brand) === want) return p.brand;
  }
  return null;
}
