// ============================================================================
// Homepage wellness showcase, data shaping.
//
// The storefront sells nutraceuticals across eight health concerns (see the
// `wellness` taxon in category-taxonomy.ts). This module turns the live
// wellness product set into the structures the homepage WellnessSection
// renders: one card per concern (with a live product count + "from" price)
// and a featured product rail. Counts and prices are derived from the passed
// products, never hard-coded, so the section can never drift from the catalog.
// ============================================================================

import type { Product } from '@/types';
import { categoryHref } from '@/lib/category-taxonomy';

export interface WellnessConcern {
  /** Canonical category label (matches products.category + the taxonomy). */
  label: string;
  /** Stable key for icon lookup + analytics ("womens-health"). */
  key: string;
  /** One-line concern blurb shown under the label. */
  tagline: string;
  /** Live count of published products in this concern. */
  count: number;
  /** Lowest published price in this concern, or null when empty. */
  fromPrice: number | null;
  /** /shop link pre-filtered to this concern. */
  href: string;
}

// Display order + copy + icon key for each wellness concern. Order is curated
// (broad, high-volume concerns first) rather than alphabetical so the grid
// reads as a considered range, not a data dump. Icon keys map to the inline
// SVGs in WellnessSection (lucide-style, per the project icon guidance, no
// emoji). Every label here must exist in the `wellness` taxon.
const CONCERN_META: { label: string; key: string; tagline: string }[] = [
  { label: "Women's Health",     key: 'womens-health',  tagline: 'Fertility, prenatal & hormonal balance' },
  { label: "Men's Health",       key: 'mens-health',    tagline: 'Energy, stamina & performance' },
  { label: 'Immunity',           key: 'immunity',       tagline: 'Daily defence with zinc & vitamin C' },
  { label: 'Bone & Joint',       key: 'bone-joint',     tagline: 'Calcium, collagen & mobility' },
  { label: 'Heart Health',       key: 'heart-health',   tagline: 'Omega-3s & cardiovascular support' },
  { label: 'Digestive & Gut',    key: 'digestive-gut',  tagline: 'Probiotics & everyday gut comfort' },
  { label: 'Cough & Respiratory', key: 'respiratory',   tagline: 'Soothing syrups for easy breathing' },
  { label: 'Kids',               key: 'kids',           tagline: 'Gentle syrups for growing children' },
];

/** Build the per-concern cards from a live wellness product set. Concerns with
 *  no published products are dropped so the grid never shows an empty card. */
export function buildWellnessConcerns(products: Product[]): WellnessConcern[] {
  return CONCERN_META.map((meta) => {
    const inCat = products.filter((p) => p.category === meta.label);
    const fromPrice = inCat.length ? Math.min(...inCat.map((p) => p.price)) : null;
    return {
      label: meta.label,
      key: meta.key,
      tagline: meta.tagline,
      count: inCat.length,
      fromPrice,
      href: categoryHref(meta.label),
    };
  }).filter((c) => c.count > 0);
}

export interface WellnessShowcase {
  concerns: WellnessConcern[];
  /** Featured wellness products for the rail (bestsellers first). */
  rail: Product[];
  /** Total published wellness SKUs across all concerns. */
  totalCount: number;
}

/** Shape a full wellness product set into the homepage showcase. The rail
 *  comes from the merchandising composer (demand-ordered, deduped against
 *  the rails above, rotating daily); concern cards always derive from the
 *  FULL set so counts and from-prices stay accurate. */
export function buildWellnessShowcase(products: Product[], rail?: Product[]): WellnessShowcase {
  const concerns = buildWellnessConcerns(products);
  return {
    concerns,
    rail: rail ?? products.slice(0, 8),
    totalCount: products.length,
  };
}
