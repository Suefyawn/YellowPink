// ============================================================================
// Top-level nav taxonomy.
//
// The flat `category` column on `products` carries fine-grained values like
// "Lip & Cheek Tints", "Highlighters", "Human Health", "Bone Health" — too
// many to surface as primary nav items. The TAXONS below group them into
// the 4 top-level sections that drive the storefront header and the
// CategoryTiles section on the homepage.
//
// The taxonomy is data: editors can re-shuffle categories between taxons
// without a code change to consumers (Header + Shop page expand the taxon
// to its category set via `categoriesForTaxon`).
// ============================================================================

export type TaxonKey = 'makeup' | 'skincare' | 'wellness' | 'bundles';

export interface Taxon {
  key: TaxonKey;
  /** Display label used in nav + filter chips. */
  label: string;
  /** Marketing tagline shown on the CategoryTiles homepage section. */
  tagline: string;
  /** Exact category values (post-HTML-decode) that belong to this taxon. */
  categories: readonly string[];
}

export const TAXONS: readonly Taxon[] = [
  {
    key: 'makeup',
    label: 'Makeup',
    tagline: 'Lip, cheek, face & eyes',
    categories: [
      'Lip & Cheek Tints',
      'Face Makeup',
      'Eyes',
      'Highlighters',
      'Brushes & Tools',
    ],
  },
  {
    key: 'skincare',
    label: 'Skincare',
    tagline: 'Cleanse, treat & protect',
    categories: [
      'Cleansers & Treatments',
      'Moisturizers',
      'Hair Care',
    ],
  },
  {
    key: 'wellness',
    label: 'Wellness',
    tagline: 'Supplements & daily health',
    categories: [
      "Women's Health",
      "Men's Health",
      'Immunity',
      'Bone & Joint',
      'Heart Health',
      'Digestive & Gut',
      'Cough & Respiratory',
      'Kids',
    ],
  },
  {
    key: 'bundles',
    label: 'Bundles',
    tagline: 'Combo packs & value picks',
    categories: [
      'Combo Packs',
      'Budget Bundles',
    ],
  },
];

const TAXON_BY_KEY: Record<TaxonKey, Taxon> =
  Object.fromEntries(TAXONS.map(t => [t.key, t])) as Record<TaxonKey, Taxon>;

const TAXON_BY_LABEL: Record<string, Taxon> =
  Object.fromEntries(TAXONS.map(t => [t.label.toLowerCase(), t]));

/** Lookup a taxon by key OR label (case-insensitive). Returns null on miss. */
export function findTaxon(slug: string | null | undefined): Taxon | null {
  if (!slug) return null;
  const s = slug.toLowerCase();
  return TAXON_BY_KEY[s as TaxonKey] ?? TAXON_BY_LABEL[s] ?? null;
}

/** All category values that belong to the taxon — used by the Shop page
 *  to expand a `?category=Makeup` URL into a multi-category filter. */
export function categoriesForTaxon(slug: string | null | undefined): readonly string[] | null {
  return findTaxon(slug)?.categories ?? null;
}

/** Reverse lookup: which taxon does a given fine-grained category belong to?
 *  Used by breadcrumbs and "shop more like this" CTAs on PDP. */
export function taxonForCategory(category: string | null | undefined): Taxon | null {
  if (!category) return null;
  for (const t of TAXONS) {
    if (t.categories.includes(category)) return t;
  }
  return null;
}

// Health/YMYL categories — used to decide where a medical disclaimer must
// show. Covers the product "wellness" taxon leaves (Women's Health, Immunity,
// Bone & Joint, …) PLUS blog-only health categories that aren't product leaves
// ("Wellness", "Fertility"). Beauty categories (Skincare, Makeup, Hair) return
// false — they don't need a medical disclaimer.
const HEALTH_BLOG_CATEGORIES = new Set(
  ['Wellness', 'Fertility', 'Health'].map(s => s.toLowerCase()),
);
export function isHealthCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  if (taxonForCategory(category)?.key === 'wellness') return true;
  return HEALTH_BLOG_CATEGORIES.has(category.trim().toLowerCase());
}

// Richer on-page intro copy for the wellness category landing pages — these
// target competitive head terms ("women's health supplements Pakistan", …), so
// a unique, genuinely useful 2–3 sentence intro (vs the one-line meta blurb in
// CATEGORY_DESCRIPTIONS) gives Google real on-page content to rank. Compliant
// by design: no disease/cure claims. Categories without an entry fall back to
// the short CATEGORY_DESCRIPTIONS line.
export const CATEGORY_INTRO: Record<string, string> = {
  "Women's Health":
    "Yellow Pink's women's health range covers fertility support, prenatal and postnatal nutrition, hormonal balance, iron and everyday vitality — from trusted international supplement brands. Whether you're planning a pregnancy, managing your cycle, or simply topping up key nutrients, every product here is 100% authentic and sealed, with cash on delivery nationwide across Pakistan.",
  "Men's Health":
    "Support energy, stamina, fertility and everyday performance with our men's health supplements — from L-arginine and CoQ10 sachets to testosterone-support herbs and daily multivitamins. Each product is 100% genuine and imported, delivered with cash on delivery anywhere in Pakistan.",
  'Immunity':
    "Give your body's everyday defences a hand with our immunity range — vitamin C, vitamin D, zinc, elderberry and multivitamin formulas from reputable global brands. Ideal for seasonal changes and busy routines, all authentic and sealed, with cash on delivery across Pakistan.",
  'Bone & Joint':
    'Keep moving comfortably with our bone and joint supplements — calcium and vitamin D for bone strength, plus glucosamine, chondroitin and collagen for joint support. Popular with active adults and older family members alike, all 100% authentic, with cash on delivery nationwide in Pakistan.',
  'Heart Health':
    'Look after your cardiovascular wellbeing with our heart health range — omega-3 fish oils, CoQ10 and other supplements that support a healthy heart and circulation. Sourced from trusted international brands, genuine and sealed, with cash on delivery across Pakistan.',
  'Digestive & Gut':
    'Support comfortable digestion and a balanced gut with our probiotics, prebiotics and digestive-enzyme supplements. From daily gut maintenance to occasional bloating, find authentic, well-stored products here, with cash on delivery anywhere in Pakistan.',
  'Cough & Respiratory':
    'Soothe seasonal coughs and support healthy breathing with our respiratory range — herbal syrups, lozenges and vitamin blends from trusted brands. Every product is 100% genuine and sealed, delivered cash on delivery across Pakistan.',
  'Kids':
    'Gentle, easy-to-take syrups, gummies and supplements made for growing children — from everyday multivitamins to immunity and bone support. Chosen for taste and trust, every product is authentic and sealed, with cash on delivery nationwide in Pakistan.',
  // Beauty & bundle landing pages — same keyword-led treatment for the
  // higher-volume cosmetic categories and value sets.
  'Cleansers & Treatments':
    'From gentle daily cleansers and foaming washes to targeted serums, exfoliants and acne treatments, our cleansers & treatments range helps you build a routine for clearer, healthier-looking skin. Every product is 100% authentic and imported, with cash on delivery across Pakistan.',
  'Lip & Cheek Tints':
    'Add a wash of natural colour with our lip and cheek tints — buildable, long-wearing formulas from popular K-beauty and international brands for an effortless flush. All genuine and sealed, with cash on delivery nationwide in Pakistan.',
  'Face Makeup':
    'Build a flawless base with our face makeup — foundations, concealers, powders and primers to even tone, blur pores and set your look. 100% authentic and imported, with cash on delivery across Pakistan.',
  'Moisturizers':
    'Lock in hydration with our moisturisers — lightweight gels, rich creams and barrier-repair formulas for every skin type and season. Authentic and sealed, with cash on delivery nationwide in Pakistan.',
  'Highlighters':
    'Catch the light with our highlighters — powder, liquid and stick formulas that add a natural glow or a bolder strobe. 100% genuine and imported, with cash on delivery across Pakistan.',
  'Combo Packs':
    'Save with our combo packs — curated sets that pair complementary skincare, makeup and wellness products at a better price than buying them separately. All authentic and sealed, with cash on delivery across Pakistan.',
  'Budget Bundles':
    'Get more for less with our budget bundles — value sets of everyday beauty and wellness essentials, hand-picked to stretch your rupee further. 100% genuine, with cash on delivery nationwide in Pakistan.',
};

// Per-taxon SEO: the four top-level nav landing pages (/shop?taxon=<key>) are
// real index targets, so each gets a unique, keyword-led title + meta
// description + intro instead of the generic "Shop All Products" + a canonical
// pointing back at /shop. Titles stay short (the layout appends "| Yellow
// Pink"); descriptions double as the on-page intro copy.
export const TAXON_SEO: Record<TaxonKey, { title: string; description: string }> = {
  makeup: {
    title: 'Makeup in Pakistan — Buy Authentic',
    description: 'Shop imported makeup at Yellow Pink — foundation, concealer, blush, lip & cheek tints, highlighters and brushes from international brands. 100% authentic, with cash on delivery across Pakistan.',
  },
  skincare: {
    title: 'Skincare in Pakistan — Buy Authentic',
    description: 'Shop imported skincare at Yellow Pink — cleansers, serums, moisturisers, sunscreens and K-beauty favourites. 100% authentic, with cash on delivery across Pakistan.',
  },
  wellness: {
    title: 'Wellness & Supplements in Pakistan',
    description: 'Shop vitamins and supplements at Yellow Pink — immunity, bone & joint, heart, digestive, women’s and men’s health and more. Authentic, with cash on delivery across Pakistan.',
  },
  bundles: {
    title: 'Bundles & Combo Packs in Pakistan',
    description: 'Shop value bundles and combo packs at Yellow Pink — curated skincare, makeup and wellness sets at the best prices, with cash on delivery across Pakistan.',
  },
};

// ── Category landing-page copy ──────────────────────────────────────────────
// Intro copy shown on each Shop category/taxon page AND reused as that page's
// meta description, so every category landing page has unique, indexable text
// instead of all sharing one generic line. Keyed by taxon labels and by the
// fine-grained leaf categories.
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  All: 'Imported, authentic, and tested for Pakistani skin. Every product earns its place.',

  // ── Taxons ──
  Makeup: 'Authentic imported makeup from the world\'s best brands, available in Pakistan.',
  Skincare: 'Science-backed skincare formulas that actually work on Pakistani skin.',
  Wellness: 'Clinical-grade nutraceuticals for fertility, immunity, and daily vitality.',
  Bundles: 'Curated combos and value packs — more of what you love, for less.',

  // ── Makeup leaves ──
  'Lip & Cheek Tints': 'Multi-use tints that bring a natural flush to lips and cheeks — buildable, blendable colour in a single step.',
  'Face Makeup': 'Foundations, concealers and complexion essentials for a smooth, true-to-tone base that lasts all day.',
  'Eyes': 'Eyeshadows, liners and mascaras to define, deepen and finish any eye look.',
  'Highlighters': 'Liquid and powder highlighters for a lit-from-within glow that flatters every skin tone.',
  'Brushes & Tools': 'Makeup brushes, sponges and beauty tools for a smooth, professional finish at home.',

  // ── Skincare leaves ──
  'Cleansers & Treatments': 'Face washes, exfoliants and targeted treatments to cleanse, clear and renew your skin.',
  'Moisturizers': 'Hydrating creams and lotions that soften, nourish and strengthen your skin barrier.',
  'Hair Care': 'Shampoos, treatments and hair supplements for stronger, healthier hair from root to tip.',

  // ── Wellness leaves ──
  "Women's Health": 'Supplements formulated for women — fertility, prenatal nutrition, hormonal balance and everyday vitality.',
  "Men's Health": "Targeted supplements for men's energy, stamina and everyday performance.",
  'Immunity': "Vitamins, minerals and herbal supplements to support your body's everyday defences.",
  'Bone & Joint': 'Calcium, collagen and joint-support supplements to help you stay mobile and strong.',
  'Heart Health': 'Omega-3s and cardiovascular supplements that support a healthy, well-functioning heart.',
  'Digestive & Gut': 'Probiotics and digestive supplements for a comfortable, balanced gut.',
  'Cough & Respiratory': 'Syrups and lozenges to soothe coughs and support clear, easy breathing.',
  'Kids': 'Gentle syrups and supplements made for growing children — easy to take, easy to trust.',

  // ── Bundle leaves ──
  'Combo Packs': 'Hand-picked product pairings that work better together — curated combos at a friendlier price.',
  'Budget Bundles': 'Everyday favourites bundled into wallet-friendly value packs.',
};

/** Every fine-grained leaf category, flattened across all taxons. */
export const ALL_CATEGORIES: readonly string[] = TAXONS.flatMap(t => t.categories);

const slugifyCategory = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Leaf category lookup keyed by both the lower-cased label and its slug
// ("combo-packs"), so either URL form resolves to the canonical label.
const CATEGORY_BY_KEY: Record<string, string> = Object.fromEntries(
  ALL_CATEGORIES.flatMap(c => [
    [c.toLowerCase(), c] as [string, string],
    [slugifyCategory(c), c] as [string, string],
  ]),
);

/**
 * Resolve a `?category=` value — a canonical label ("Combo Packs"), a slug
 * ("combo-packs"), or a taxon ("makeup" / "Makeup") — to its canonical display
 * label. Returns null for "All" / unknown values. Collapsing the label-vs-slug
 * variants onto one label keeps the Shop page's title + canonical URL stable,
 * so the same category is not indexed under two competing URLs.
 */
export function canonicalCategory(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v || v.toLowerCase() === 'all') return null;
  const taxon = findTaxon(v);
  if (taxon) return taxon.label;
  return CATEGORY_BY_KEY[v.toLowerCase()] ?? null;
}
