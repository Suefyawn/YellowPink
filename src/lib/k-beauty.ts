// ============================================================================
// K-Beauty brand edit.
//
// The K-Beauty storefront surfaces (homepage section + /k-beauty collection
// page) are a *brand* edit, not a category: Korean products live in regular
// leaf categories ("Cleansers & Treatments", "Lip & Cheek Tints", …) so a
// category filter can't isolate them. Instead we curate the list of Korean /
// Korean-formulated brands here and query the catalog by brand. Adding a new
// K-beauty brand to the storefront is a one-entry change below — no schema
// or component edits.
// ============================================================================

export interface KBeautyBrand {
  name: string;
  /** One-line hook shown on the brand card. */
  tagline: string;
  /** Short editorial blurb for the /k-beauty brand spotlight. */
  blurb: string;
}

/** Brands included in the K-Beauty edit. Glow Recipe is US-founded but its
 *  range is formulated and made in Korea, which is how shoppers categorise
 *  it — it belongs in this edit. */
export const K_BEAUTY_BRAND_INFO: readonly KBeautyBrand[] = [
  {
    name: 'Beauty of Joseon',
    tagline: 'Hanbang heritage, modern formulas',
    blurb: 'Centuries-old Korean herbal wisdom — rice, ginseng and fermented botanicals — reworked into gentle, barrier-first staples. Home of the cult Relief Sun SPF.',
  },
  {
    name: 'Glow Recipe',
    tagline: 'Fruit-powered glow',
    blurb: 'Watermelon, plum and pomegranate actives in juicy, formulated-in-Korea treatments. The brand that made the dewy "glazed" look a worldwide ritual.',
  },
  {
    name: 'SKIN1004',
    tagline: 'Single-origin centella',
    blurb: 'Madagascar-grown centella asiatica, untouched by pollution, in calming ampoules that soothe redness and brighten sensitised skin.',
  },
];

export const K_BEAUTY_BRANDS: readonly string[] = K_BEAUTY_BRAND_INFO.map(b => b.name);

/** The dedicated K-Beauty collection landing page. */
export const K_BEAUTY_PAGE_URL = '/k-beauty';

/** Shop listing for the whole edit. CollectionPage treats `?brand=` as a
 *  comma-separated multi-brand filter. */
export const K_BEAUTY_SHOP_URL = `/shop?brand=${encodeURIComponent(K_BEAUTY_BRANDS.join(','))}`;

/** Shop listing for a single brand in the edit. */
export const kBeautyBrandShopUrl = (brand: string) => `/shop?brand=${encodeURIComponent(brand)}`;

/** Compact FAQ for the /k-beauty page — rendered on-page and mirrored as
 *  FAQPage JSON-LD. Lives here (not in the client section component) so the
 *  server route can read it for the structured data. */
export const K_BEAUTY_FAQ: readonly { question: string; answer: string }[] = [
  {
    question: 'Are these Korean products original?',
    answer: 'Yes — every product in the K-Beauty edit is imported and 100% authentic. We source sealed retail stock and stand behind every batch.',
  },
  {
    question: 'Do you deliver Korean skincare across Pakistan?',
    answer: 'We deliver nationwide — Karachi, Lahore, Islamabad and everywhere in between — with cash on delivery available on every order.',
  },
  {
    question: 'Which K-beauty product should I start with?',
    answer: 'A sunscreen. Beauty of Joseon Relief Sun is the easiest first step: featherweight SPF 50+ that layers under makeup without a white cast.',
  },
];
