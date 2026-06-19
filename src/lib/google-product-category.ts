// Maps Yellow Pink's internal product categories to Google Product Category
// IDs (https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt).
//
// Why this exists: Merchant Center + Meta Commerce require `google_product_category`
// to be a value from *Google's* taxonomy — a numeric ID or the exact full path.
// The feeds previously emitted our own internal label (e.g. "Face Makeup"), which
// Google ignores/disapproves. Numeric IDs are language-independent and the least
// error-prone, so we map to IDs and fall back to the top-level Health & Beauty
// node (469) for anything unmapped — the whole catalogue is health/beauty, so a
// generic-but-valid category is always safe and better than an invalid one.
//
// `g:product_type` keeps the internal category (it's a free-form, store-owned
// field); only `g:google_product_category` needs these mapped values.

// Health & Beauty > … taxonomy IDs.
const HEALTH_AND_BEAUTY = 469;            // Health & Beauty (generic fallback)
const VITAMINS_SUPPLEMENTS = 525;         // > Health Care > Fitness & Nutrition > Vitamins & Supplements

const CATEGORY_TO_GOOGLE: Record<string, number> = {
  // ── Makeup ──────────────────────────────────────────────────────────────
  'face makeup':            2571, // > Personal Care > Cosmetics > Makeup > Face Makeup
  'highlighters':           6304, // > Face Makeup > Highlighters & Luminizers
  'lip & cheek tints':      6306, // > Makeup > Lip Makeup > Lip & Cheek Stains
  'makeup':                 477,  // > Cosmetics > Makeup
  'eyes':                   2779, // > Makeup > Eye Makeup
  'brushes & tools':        2548, // > Cosmetics > Cosmetic Tools > Makeup Tools
  // ── Skin & hair ─────────────────────────────────────────────────────────
  'cleansers & treatments': 567,  // > Cosmetics > Skin Care
  'moisturizers':           2592, // > Skin Care > Lotion & Moisturizer
  'sunscreens':             2844, // > Skin Care > Sunscreen
  'hair care':              486,  // > Personal Care > Hair Care
  // ── Wellness / nutraceuticals → Vitamins & Supplements ──────────────────
  "women's health":         VITAMINS_SUPPLEMENTS,
  'bone & joint':           VITAMINS_SUPPLEMENTS,
  'immunity':               VITAMINS_SUPPLEMENTS,
  "men's health":           VITAMINS_SUPPLEMENTS,
  'digestive & gut':        VITAMINS_SUPPLEMENTS,
  'cough & respiratory':    VITAMINS_SUPPLEMENTS,
  'heart health':           VITAMINS_SUPPLEMENTS,
  // ── Ambiguous (mixed makeup/supplement bundles, kids) → generic ─────────
  'kids':                   HEALTH_AND_BEAUTY,
  'combo packs':            HEALTH_AND_BEAUTY,
  'budget bundles':         HEALTH_AND_BEAUTY,
};

/**
 * Resolve a store category to a valid Google Product Category ID. Unknown or
 * null categories fall back to the top-level Health & Beauty node so the feed
 * always carries a valid value.
 */
export function googleProductCategory(internal: string | null | undefined): number {
  if (!internal) return HEALTH_AND_BEAUTY;
  return CATEGORY_TO_GOOGLE[internal.trim().toLowerCase()] ?? HEALTH_AND_BEAUTY;
}
