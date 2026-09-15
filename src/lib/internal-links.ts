// Outbound internal links in editorial content, checked against the catalogue.
//
// WHY THIS EXISTS. Archiving or drafting a product does not touch the articles
// that recommend it, so every link to it silently becomes a hard 404. On
// 14 Sep archiving the Hello Hair brand broke five links, two of them on
// /blog/best-shampoo-in-pakistan, which is the single biggest entry point to
// the store. Nobody noticed. A scan on 15 Sep found 23 dead product links
// across 21 articles, some of them months old.
//
// The existing broken-links screen reads `not_found_log`, which is REACTIVE:
// it only learns a link is dead once a real visitor has hit the 404. By then
// the store has already paid for it, and on a site where most arrivals come
// from an assistant citing a specific article, the visitor who hits it is
// exactly the one who was ready to buy.
//
// This module is the proactive half: given the published catalogue, it reads
// the links an article actually contains and says which ones point at
// something a shopper cannot reach. Pure and synchronous so it can be unit
// tested against real article bodies rather than a live database.

/** A link found in editorial content, resolved against the catalogue. */
export interface InternalLink {
  /** Slug referenced by the link, e.g. "cerave-anti-dandruff-hydrating-shampoo". */
  slug: string;
  /** What the link points at. */
  kind: 'product' | 'collection';
  /** How many times this target appears in the body. Repeats matter: a
   *  product named in a picks list, a comparison table and a closing call to
   *  action is three chances to hit the 404, not one. */
  occurrences: number;
}

export interface DeadLink extends InternalLink {
  /** Where the content lives, e.g. a blog slug. */
  source: string;
  /** 'draft' and 'archived' are recoverable (the product may come back);
   *  'missing' means no such row exists at all. */
  reason: 'draft' | 'archived' | 'missing';
}

export type CatalogueStatus = 'published' | 'draft' | 'archived';

const PRODUCT_RE = /\/product\/([a-z0-9][a-z0-9-]*)/gi;
const COLLECTION_RE = /\/collection\/([a-z0-9][a-z0-9-]*)/gi;

/** Every internal product/collection link in one body, de-duplicated with a
 *  count. Case-insensitive on the slug because hand-written HTML is not
 *  always consistent, and the database slugs are lower case. */
export function extractInternalLinks(body: string | null | undefined): InternalLink[] {
  if (!body) return [];
  const counts = new Map<string, InternalLink>();

  const scan = (re: RegExp, kind: InternalLink['kind']) => {
    re.lastIndex = 0;
    for (let m = re.exec(body); m !== null; m = re.exec(body)) {
      const slug = m[1].toLowerCase();
      const key = `${kind}:${slug}`;
      const seen = counts.get(key);
      if (seen) seen.occurrences += 1;
      else counts.set(key, { slug, kind, occurrences: 1 });
    }
  };

  scan(PRODUCT_RE, 'product');
  scan(COLLECTION_RE, 'collection');
  return [...counts.values()];
}

/** Resolve one source's links against the catalogue, returning only the ones
 *  a shopper cannot reach.
 *
 *  A slug absent from the map is 'missing' rather than assumed fine: a typo in
 *  a hand-written href fails exactly like an archived product, and telling
 *  them apart is what decides whether the fix is a redirect or a re-publish. */
export function findDeadLinks(
  source: string,
  body: string | null | undefined,
  products: ReadonlyMap<string, CatalogueStatus>,
  collections?: ReadonlyMap<string, CatalogueStatus>,
): DeadLink[] {
  const dead: DeadLink[] = [];
  for (const link of extractInternalLinks(body)) {
    const map = link.kind === 'product' ? products : collections;
    if (!map) continue; // caller did not supply this catalogue; do not guess
    const status = map.get(link.slug);
    if (status === 'published') continue;
    dead.push({ ...link, source, reason: status ?? 'missing' });
  }
  return dead;
}

/** Worst first: the thing to fix is the one a visitor meets most often. */
export function rankDeadLinks(links: readonly DeadLink[]): DeadLink[] {
  const weight = (r: DeadLink['reason']) => (r === 'missing' ? 2 : r === 'archived' ? 1 : 0);
  return [...links].sort(
    (a, b) =>
      b.occurrences - a.occurrences ||
      weight(b.reason) - weight(a.reason) ||
      a.source.localeCompare(b.source) ||
      a.slug.localeCompare(b.slug),
  );
}
