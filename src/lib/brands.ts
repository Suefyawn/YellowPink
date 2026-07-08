// ============================================================================
// Brand helpers.
//
// `products.brand` is a free text column; the `brands` table (migration 150)
// adds optional first-class metadata layered on top, slug, copy, logo, hero,
// SEO, status. Brand pages keep working without a brands row for a given
// product (the derived path is the fallback); rows let the owner edit copy
// and upload assets in admin.
// ============================================================================

import { supabase } from '@/lib/supabase';
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

// ─── Brand metadata (migration 150) ────────────────────────────────────────

export interface BrandRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  status: 'published' | 'draft';
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
}

/** Load a single published brand record by slug, or null if no row exists. */
export async function getBrandRecord(slug: string): Promise<BrandRecord | null> {
  const { data } = await supabase
    .from('brands').select('*')
    .eq('slug', slug).eq('status', 'published').maybeSingle();
  return (data as BrandRecord | null) ?? null;
}

export interface BrandLogoEntry { name: string; logoUrl: string | null }

/** Resolve the admin-curated homepage "brand logos row" (a comma-separated
 *  list of brand NAMES in site_settings) to their actual logo images.
 *  Preserves the admin's chosen order; a name with no published logo (a stale
 *  pick, or hand-typed before the logo picker existed) still comes back with
 *  logoUrl: null so the caller can fall back to a plain text label instead of
 *  silently dropping it. */
export async function resolveBrandLogos(names: string[]): Promise<BrandLogoEntry[]> {
  const wanted = names.map(n => n.trim()).filter(Boolean);
  if (wanted.length === 0) return [];
  const { data } = await supabase
    .from('brands')
    .select('name, logo_url')
    .in('name', wanted)
    .eq('status', 'published');
  const logoByName = new Map((data ?? []).map(r => [r.name as string, r.logo_url as string | null]));
  return wanted.map(name => ({ name, logoUrl: logoByName.get(name) ?? null }));
}

/** Brands eligible for the homepage logo-row picker: published, with a real
 *  logo uploaded, ranked by how many published products carry that name (a
 *  simple "how prominent is this brand in our catalogue" proxy for "famous"),
 *  so the picker's own top-to-bottom order already surfaces the most relevant
 *  candidates first. */
export interface BrandLogoCandidate { name: string; slug: string; logoUrl: string; productCount: number }

export async function getBrandLogoCandidates(): Promise<BrandLogoCandidate[]> {
  const [{ data: brandRows }, { data: productRows }] = await Promise.all([
    supabase.from('brands').select('name, slug, logo_url').eq('status', 'published').not('logo_url', 'is', null),
    supabase.from('products').select('brand').eq('status', 'published'),
  ]);
  const counts = new Map<string, number>();
  for (const p of (productRows ?? []) as Array<{ brand: string | null }>) {
    if (!p.brand) continue;
    counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
  }
  return ((brandRows ?? []) as Array<{ name: string; slug: string; logo_url: string }>)
    .map(b => ({ name: b.name, slug: b.slug, logoUrl: b.logo_url, productCount: counts.get(b.name) ?? 0 }))
    .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name));
}

/** Brand directory entry: derived count + optional metadata. */
export interface BrandDirectoryEntry extends BrandSummary {
  description: string | null;
  logo_url: string | null;
  /** First image among this brand's products, used to auto-fill a cover/logo
   *  on the directory + landing page when no real asset has been uploaded. */
  product_image_url: string | null;
  sort_order: number;
}

/** Brand directory: every brand with at least one product, joined with its
 *  metadata row (if any). Sort order = brands.sort_order then name. */
export async function getBrandDirectory(products: Product[]): Promise<BrandDirectoryEntry[]> {
  const summaries = brandsFromProducts(products);
  if (summaries.length === 0) return [];

  const { data } = await supabase
    .from('brands')
    .select('slug, description, logo_url, hero_image_url, sort_order, status')
    .eq('status', 'published');
  const meta = new Map<string, BrandRecord>();
  for (const r of (data ?? []) as BrandRecord[]) meta.set(r.slug, r);

  // Pre-index a representative product image per brand so the index card can
  // always show something when no real logo is uploaded, same fallback idea
  // collections use.
  const firstImageBySlug = new Map<string, string>();
  for (const p of products) {
    if (!p.brand || !p.image_url) continue;
    const s = brandSlug(p.brand);
    if (!firstImageBySlug.has(s)) firstImageBySlug.set(s, p.image_url);
  }

  // Brands with a metadata row carry the brands.sort_order column default
  // (100); brands that only exist as a free-text product field have no row.
  // Defaulting those to the SAME baseline (not a larger sentinel) lets the two
  // sets interleave into one alphabetical list — the old 1000 default sorted
  // every metadata-less brand into a second A→Z group after the first, so the
  // directory ran "A–T, then restarted at C". A brand deliberately curated to
  // a lower sort_order still pins ahead of the rest.
  const DEFAULT_BRAND_SORT = 100; // must match the brands.sort_order column default
  return summaries
    .map<BrandDirectoryEntry>(b => {
      const m = meta.get(b.slug);
      return {
        ...b,
        description: m?.description ?? null,
        logo_url: m?.logo_url ?? null,
        product_image_url: firstImageBySlug.get(b.slug) ?? null,
        sort_order: m?.sort_order ?? DEFAULT_BRAND_SORT,
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}
