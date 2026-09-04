// ============================================================================
// Top-level nav taxonomy.
//
// The flat `category` column on `products` carries fine-grained values like
// "Lip & Cheek Tints", "Highlighters", "Human Health", "Bone Health", too
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
      'Nails',
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
      'Sleep & Relaxation',
      'Brain & Cognitive',
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

/** All category values that belong to the taxon, used by the Shop page
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

// Health/YMYL categories, used to decide where a medical disclaimer must
// show. Covers the product "wellness" taxon leaves (Women's Health, Immunity,
// Bone & Joint, …) PLUS blog-only health categories that aren't product leaves
// ("Wellness", "Fertility"). Beauty categories (Skincare, Makeup, Hair) return
// false, they don't need a medical disclaimer.
const HEALTH_BLOG_CATEGORIES = new Set(
  ['Wellness', 'Fertility', 'Health'].map(s => s.toLowerCase()),
);
export function isHealthCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  if (taxonForCategory(category)?.key === 'wellness') return true;
  return HEALTH_BLOG_CATEGORIES.has(category.trim().toLowerCase());
}

/** URL slug for a leaf category. "Lip & Cheek Tints" → "lip-cheek-tints". */
export function categorySlug(category: string): string {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Canonical href for a category landing page. Leaf categories live at the
 *  path route /category/<slug> — a clean, crawlable, ISR-cached URL (the old
 *  /shop?category= parameter pages were fully dynamic, near-unlinked
 *  internally, and normalised poorly in search). A taxon label still points
 *  at its /shop?taxon= landing page. */
export function categoryHref(category: string): string {
  const taxon = findTaxon(category);
  if (taxon) return `/shop?taxon=${taxon.key}`;
  return `/category/${categorySlug(category)}`;
}

// Richer on-page intro copy for the wellness category landing pages, these
// target competitive head terms ("women's health supplements Pakistan", …), so
// a unique, genuinely useful 2-3 sentence intro (vs the one-line meta blurb in
// CATEGORY_DESCRIPTIONS) gives Google real on-page content to rank. Compliant
// by design: no disease/cure claims. Categories without an entry fall back to
// the short CATEGORY_DESCRIPTIONS line.
export const CATEGORY_INTRO: Record<string, string> = {
  // ── Taxon head-term landing pages ──
  // These four are the highest-traffic /shop?taxon= pages; give each a full
  // keyword-led paragraph instead of the short CATEGORY_DESCRIPTIONS one-liner
  // (CollectionPage renders CATEGORY_INTRO[cat] ?? CATEGORY_DESCRIPTIONS[cat]).
  'Makeup':
    "Shop authentic makeup at Yellow Pink: foundations, concealers, powders and primers for a flawless base, plus blushes and lip colour, highlighters, eye makeup, nail polish and brushes from international brands like Huda Beauty, NARS, Charlotte Tilbury, Rare Beauty and Pixi alongside local favourites. Whether you're building an everyday no-makeup look or a bold going-out face, every product here is 100% genuine and sealed, with cash on delivery nationwide across Pakistan.",
  'Skincare':
    'Build a routine that actually works for Pakistani skin with our imported and Korean skincare, gentle cleansers, targeted serums, lightweight moisturisers, sunscreens and treatments for acne, pigmentation and dullness. We stock K-beauty favourites alongside trusted international brands, all 100% authentic and sealed, with cash on delivery nationwide across Pakistan.',
  'Wellness':
    "Support your health from the inside out with our wellness range, vitamins and supplements for immunity, bone and joint strength, heart health, digestion, sleep, focus, kids and women's and men's wellbeing, from trusted brands. From everyday multivitamins to targeted fertility and energy support, every product is genuine, sealed and correctly stored, with cash on delivery across Pakistan.",
  'Bundles':
    'Get more for your money with our bundles and combo packs, curated sets that pair complementary skincare, makeup and wellness products at a better price than buying each separately. Hand-picked to work well together and ideal for gifting or trying a full routine, all 100% authentic and sealed, with cash on delivery nationwide across Pakistan.',
  // ── Leaf categories that previously had only a short one-liner ──
  'Eyes':
    'Define and finish any eye look with our eye makeup: eyeshadow palettes, liquid eyeliner, kajal and mascara, plus a bakuchiol eye cream, from popular international, K-beauty and Pakistani brands. From soft everyday definition to a bold smokey eye, every product is 100% authentic, with cash on delivery across Pakistan.',
  'Brushes & Tools':
    'Get a smooth, professional finish at home with our makeup brushes, sponges and beauty tools, for flawless blending of foundation, concealer, powder and eye makeup. Durable, easy to clean and chosen to suit every routine, all genuine and imported, with cash on delivery nationwide across Pakistan.',
  'Hair Care':
    'Care for stronger, healthier hair with our hair care range: anti-dandruff shampoos, an argan oil hair mask, rosemary and castor oils, a herbal scalp tonic and Minoxin 5% minoxidil for pattern hair loss. Sourced from trusted brands and 100% authentic, with cash on delivery nationwide across Pakistan.',
  "Women's Health":
    "Yellow Pink's women's health range covers fertility and PCOS support, prenatal and breastfeeding nutrition, iron, cycle and menopause support, collagen, pregnancy and ovulation tests, and prescription and pharmacy contraceptives such as Famila-28F, Diane-35 and emergency pills. Whether you're planning a pregnancy, managing your cycle, or simply topping up key nutrients, every product here is 100% authentic and sealed, with cash on delivery nationwide across Pakistan.",
  "Men's Health":
    "Support stamina, blood flow, fertility and everyday performance with our men's health supplements: Argivital L-arginine sachets for men's sexual wellness, X-Fit, Flex-4 and Trimo-M vitality tablets with Tribulus, Tongkat Ali and ashwagandha, Repro-M and Tryception for sperm health, plus whey, egg white and soy protein and creatine for training. Each product is 100% genuine and sealed, delivered with cash on delivery anywhere in Pakistan.",
  'Immunity':
    "Give your body's everyday defences a hand with our immunity range: vitamin C sachets and chewables, zinc, B-complex and B12, vitamin E, moringa, ginseng and daily multivitamins from trusted brands. Ideal for seasonal changes and busy routines, all authentic and sealed, with cash on delivery across Pakistan.",
  'Bone & Joint':
    'Keep moving comfortably with our bone and joint range: calcium with vitamin D3, high-strength D3 with K2 and magnesium glycinate for bone strength, glucosamine and chondroitin for joint support, B12 with D3 for nerve health, and a cooling menthol cream for sore muscles and joints. Popular with active adults and older family members alike, all 100% authentic, with cash on delivery nationwide in Pakistan.',
  'Heart Health':
    'Look after your cardiovascular wellbeing with our heart health range: omega-3 fish oil, omega 3-6-9 blends and CoQ10 capsules that support a healthy heart and circulation. Genuine and sealed, from trusted brands, with cash on delivery across Pakistan.',
  'Digestive & Gut':
    'Support comfortable digestion with our digestive range: herbal antacid syrups and effervescent calcium for acidity and gas, natural fibre for regularity, gentle constipation relief, apple cider vinegar gummies, ORS hydration sachets and a stevia sweetener. From daily gut maintenance to occasional bloating, find authentic, well-stored products here, with cash on delivery anywhere in Pakistan.',
  'Cough & Respiratory':
    'Soothe seasonal coughs and support easy breathing with our respiratory range: herbal syrups with ivy leaf and pelargonium for chesty coughs and a non-drowsy syrup for dry, tickly coughs, suitable for adults and kids. Every product is 100% genuine and sealed, delivered cash on delivery across Pakistan.',
  'Kids':
    'Gentle, easy-to-dose drops and syrups made for babies and growing children: iron, folic acid, zinc and vitamin A, D3 and C drops, a kids multivitamin bundle and herbal colic drops for infants. Chosen for taste and trust, every product is authentic and sealed, with cash on delivery nationwide in Pakistan.',
  // Beauty & bundle landing pages, same keyword-led treatment for the
  // higher-volume cosmetic categories and value sets.
  'Cleansers & Treatments':
    'From gentle daily cleansers, micellar waters and body washes to serums, exfoliating toners and scrubs, sunscreens, masks and acne treatments, our cleansers & treatments range helps you build a routine for clearer, healthier-looking skin. Every product is 100% authentic, with cash on delivery across Pakistan.',
  'Lip & Cheek Tints':
    'Add a wash of colour with our blushes, lip tints, liquid lipsticks, glosses and lip balms, buildable, long-wearing formulas from popular international brands for an effortless flush. All genuine and sealed, with cash on delivery nationwide in Pakistan.',
  'Face Makeup':
    'Build a flawless base with our face makeup: foundations, concealers, setting powders, primers, setting spray, bronzer and tinted moisturiser with SPF to even tone, blur pores and set your look. 100% authentic, with cash on delivery across Pakistan.',
  'Moisturizers':
    'Lock in hydration with our moisturisers: lightweight lotions, rich creams, barrier-repair balms and 24-hour hand and body lotions for every skin type and season. Authentic and sealed, with cash on delivery nationwide in Pakistan.',
  'Highlighters':
    'Catch the light with our highlighters, powder, liquid and stick formulas that add a natural glow or a bolder strobe. 100% genuine and imported, with cash on delivery across Pakistan.',
  'Combo Packs':
    'Save with our combo packs: curated supplement sets for couples trying to conceive, pregnancy and prenatal care, baby care, male vitality, immunity, bones and joints, and hormonal balance for women, at a better price than buying each product separately. All authentic and sealed, with cash on delivery across Pakistan.',
  'Budget Bundles':
    'Get more for less with our budget bundles: value sets of everyday skincare and makeup favourites, such as CeraVe cleanser and moisturiser pairs and a NARS blush with Tarte concealer, hand-picked to stretch your rupee further. 100% genuine, with cash on delivery nationwide in Pakistan.',
};

// Per-taxon SEO: the four top-level nav landing pages (/shop?taxon=<key>) are
// real index targets, so each gets a unique, keyword-led title + meta
// description + intro instead of the generic "Shop All Products" + a canonical
// pointing back at /shop. Titles stay short (the layout appends "| Yellow
// Pink"); descriptions double as the on-page intro copy.
export const TAXON_SEO: Record<TaxonKey, { title: string; description: string }> = {
  makeup: {
    title: 'Makeup in Pakistan, Buy Authentic',
    description: 'Shop imported makeup at Yellow Pink, foundation, concealer, blush, lip & cheek tints, highlighters and brushes from international brands. 100% authentic, with cash on delivery across Pakistan.',
  },
  skincare: {
    title: 'Skincare in Pakistan, Korean & Imported, Authentic',
    description: 'Shop imported and Korean skincare products in Pakistan at Yellow Pink, cleansers, serums, moisturisers, sunscreens and K-beauty favourites. 100% authentic, COD nationwide.',
  },
  wellness: {
    title: 'Supplements & Vitamins in Pakistan, Authentic',
    description: 'Shop health supplements and vitamins in Pakistan at Yellow Pink, immunity, bone & joint, heart, digestive, women’s and men’s health and more. Authentic, with cash on delivery.',
  },
  bundles: {
    title: 'Bundles & Combo Packs in Pakistan',
    description: 'Shop value bundles and combo packs at Yellow Pink, curated skincare, makeup and wellness sets at the best prices, with cash on delivery across Pakistan.',
  },
};

// ── Category landing-page copy ──────────────────────────────────────────────
// Intro copy shown on each Shop category/taxon page AND reused as that page's
// meta description, so every category landing page has unique, indexable text
// instead of all sharing one generic line. Keyed by taxon labels and by the
// fine-grained leaf categories.
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  All: 'Authentic makeup, skincare and supplements, with cash on delivery across Pakistan.',

  // ── Taxons ──
  Makeup: 'Authentic imported makeup from the world\'s best brands, available in Pakistan.',
  Skincare: 'Science-backed skincare formulas that actually work on Pakistani skin.',
  Wellness: 'Supplements and vitamins for fertility, immunity, bones and joints, heart, digestion, sleep and everyday health.',
  Bundles: 'Curated combos and value packs, more of what you love, for less.',

  // ── Makeup leaves ──
  'Lip & Cheek Tints': 'Liquid and cream blushes, lip tints, lipsticks, glosses and balms for a natural flush of colour on lips and cheeks.',
  'Face Makeup': 'Foundations, concealers and complexion essentials for a smooth, true-to-tone base that lasts all day.',
  'Eyes': 'Eyeshadows, liners and mascaras to define, deepen and finish any eye look.',
  'Highlighters': 'Liquid and powder highlighters for a lit-from-within glow that flatters every skin tone.',
  'Brushes & Tools': 'Makeup brushes, sponges and beauty tools for a smooth, professional finish at home.',
  'Nails': 'Nail polish and gel-effect lacquers in assorted shades for smooth, high-shine colour.',

  // ── Skincare leaves ──
  'Cleansers & Treatments': 'Face washes, serums, exfoliants, sunscreens and targeted treatments to cleanse, clear and protect your skin.',
  'Moisturizers': 'Hydrating creams and lotions that soften, nourish and strengthen your skin barrier.',
  'Hair Care': 'Shampoos, hair masks, scalp oils and minoxidil for stronger, healthier hair from root to tip.',

  // ── Wellness leaves ──
  "Women's Health": 'Fertility and PCOS support, prenatal nutrition, iron, menopause care, pregnancy tests and contraceptive pills for women.',
  "Men's Health": "Supplements for men's stamina, sexual wellness and fertility, plus protein powders and creatine for training.",
  'Immunity': "Vitamins, minerals and herbal supplements to support your body's everyday defences.",
  'Bone & Joint': 'Calcium, vitamin D3 and K2, magnesium and glucosamine supplements to help you stay mobile and strong.',
  'Heart Health': 'Omega-3 fish oil and CoQ10 supplements that support a healthy heart and circulation.',
  'Digestive & Gut': 'Antacid syrups, fibre, constipation relief and ORS for a comfortable, balanced gut.',
  'Cough & Respiratory': 'Herbal syrups to soothe dry and chesty coughs and support clear, easy breathing.',
  'Sleep & Relaxation': 'Melatonin and magnesium glycinate supplements to support restful sleep and relaxation.',
  'Brain & Cognitive': 'Ginkgo, ginseng and magnesium L-threonate supplements to support focus, memory and everyday mental clarity.',
  'Kids': 'Gentle drops and syrups for babies and growing children: iron, zinc, folic acid, vitamin drops and colic relief.',

  // ── Bundle leaves ──
  'Combo Packs': 'Hand-picked product pairings that work better together, curated combos at a friendlier price.',
  'Budget Bundles': 'Everyday favourites bundled into wallet-friendly value packs.',
};

/** Every fine-grained leaf category, flattened across all taxons. */
export const ALL_CATEGORIES: readonly string[] = TAXONS.flatMap(t => t.categories);

// Leaf category lookup keyed by both the lower-cased label and its slug
// ("combo-packs"), so either URL form resolves to the canonical label.
const CATEGORY_BY_KEY: Record<string, string> = Object.fromEntries(
  ALL_CATEGORIES.flatMap(c => [
    [c.toLowerCase(), c] as [string, string],
    [categorySlug(c), c] as [string, string],
  ]),
);

/**
 * Resolve a `?category=` value, a canonical label ("Combo Packs"), a slug
 * ("combo-packs"), or a taxon ("makeup" / "Makeup"), to its canonical display
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
