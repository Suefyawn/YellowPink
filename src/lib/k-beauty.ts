// ============================================================================
// K-Beauty brand edit.
//
// The homepage's K-Beauty section is a *brand* edit, not a category: Korean
// products live in regular leaf categories ("Cleansers & Treatments",
// "Lip & Cheek Tints", …) so a category filter can't isolate them. Instead
// we curate the list of Korean / Korean-formulated brands here and query the
// catalog by brand. Adding a new K-beauty brand to the storefront section is
// a one-line change below — no schema or component edits.
// ============================================================================

/** Brands included in the K-Beauty edit. Glow Recipe is US-founded but its
 *  range is formulated and made in Korea, which is how shoppers categorise
 *  it — it belongs in this edit. */
export const K_BEAUTY_BRANDS: readonly string[] = [
  'Beauty of Joseon',
  'Glow Recipe',
];

/** Shop listing for the whole edit. CollectionPage treats `?brand=` as a
 *  comma-separated multi-brand filter. */
export const K_BEAUTY_SHOP_URL = `/shop?brand=${encodeURIComponent(K_BEAUTY_BRANDS.join(','))}`;
