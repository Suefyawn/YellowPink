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
