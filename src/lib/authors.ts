// ============================================================================
// Author registry (SEO audit D3). Blog bylines were plain text; this maps the
// REAL byline values stored in blog_posts.author to on-site author pages
// (/author/[slug]) and to the Article JSON-LD author node's url/sameAs.
//
// Honest-scope rule: entries exist ONLY for author values that actually
// appear in the database. As of 2026-07 those are two spellings of the same
// team byline ("Yellow Pink Editorial Team" ×127, "Yellow Pink Editorial"
// ×62), which resolve to ONE Organization entry — no invented human personas,
// no fabricated credentials (that would be fake E-E-A-T). If a real named
// writer starts publishing, add a Person entry here with a truthful bio.
// ============================================================================

export interface Author {
  /** URL slug, /author/<slug>. */
  slug: string;
  /** Canonical display name (page H1 + JSON-LD name). */
  name: string;
  /** schema.org @type. A team byline is an Organization, not a Person. */
  type: 'Organization' | 'Person';
  /** Truthful bio shown on the author page and used as its meta description. */
  bio: string;
  /** Every blog_posts.author value that resolves to this author (the DB holds
   *  more than one spelling of the team byline). */
  dbNames: string[];
}

export const AUTHORS: Author[] = [
  {
    slug: 'yellow-pink-editorial',
    name: 'Yellow Pink Editorial Team',
    type: 'Organization',
    bio: 'The Yellow Pink Editorial Team writes the skincare, beauty and wellness guides on the Yellow Pink journal. Articles are researched and written in-house by the team behind the store, drawing on the products we stock and sell across Pakistan every day. Health and supplement content is additionally checked by the doctors on our Medical Review Board before and after publication — reviewed posts carry the reviewer’s name and the date of their last review. We update guides when advice, formulations or availability change, and we correct mistakes when readers point them out.',
    dbNames: ['Yellow Pink Editorial Team', 'Yellow Pink Editorial'],
  },
];

const BY_SLUG = new Map(AUTHORS.map(a => [a.slug, a]));
const BY_NAME = new Map(AUTHORS.flatMap(a => a.dbNames.map(n => [n.toLowerCase(), a] as const)));

export function authorBySlug(slug: string): Author | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Resolve a blog_posts.author byline string to a registry entry (or null for
 *  bylines that have no author page — those stay plain text). */
export function authorForName(name: string | null | undefined): Author | null {
  const n = name?.trim().toLowerCase();
  if (!n) return null;
  return BY_NAME.get(n) ?? null;
}
