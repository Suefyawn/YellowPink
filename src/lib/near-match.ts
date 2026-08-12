// ============================================================================
// Recovering a missed URL.
//
// Two DIFFERENT jobs live here, and the distinction is the whole point:
//
//   canonicalSlug()  — structural cleanup only (a trailing "-1", a "-copy", a
//                      stray "%20"). Safe to act on automatically, because the
//                      result is the *same* slug with junk removed.
//
//   rankCandidates() — fuzzy similarity, for SUGGESTING alternatives to a human.
//                      Never redirect on this. On a beauty catalogue the near
//                      misses are genuinely different products
//                      ("beauty-cream" vs "white-beauty-cream" score 0.8 and
//                      are different tubs at different prices), so an automatic
//                      hop lands the shopper on the wrong item and we would
//                      never hear about it. Show the options, let them pick.
// ============================================================================

/** Words that carry no signal in a slug, so they neither help nor hurt a match. */
const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'with', 'in', 'to']);

/** Measurement units. A number immediately before one of these is a pack size,
 *  not part of the product's identity, so both tokens drop out. That keeps
 *  "spf-30" and "no-7" (where the number IS the identity) intact. */
const UNITS = new Set(['ml', 'l', 'g', 'gm', 'gr', 'kg', 'mg', 'oz', 'pcs', 'pc']);

/**
 * Junk that accumulates on a slug: an explicit duplicate marker, optionally
 * followed by an index ("-copy", "-copy-2", "-duplicate").
 *
 * A BARE trailing number is deliberately NOT junk. "-30" on "sun-block-spf-30"
 * is the SPF, "-7" on "no-7" is the brand, and stripping either would redirect
 * a shopper onto a different product with no way for us to notice. WordPress
 * "-1" duplicates lose their automatic redirect as a result; they still get
 * ranked suggestions on the 404 page, which is the cheaper failure.
 */
const JUNK_SUFFIX = /(?:[-_](?:copy|duplicate|final|draft|old|new)(?:[-_][0-9]{1,3})?)+$/;

/** Lowercase, URL-decode, strip surrounding slashes and whitespace. */
export function cleanSlug(raw: string): string {
  let s = raw.trim();
  try { s = decodeURIComponent(s); } catch { /* malformed %-escape, use as-is */ }
  return s
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The slug this one is probably a mangled copy of, or null when it is already
 * clean. Strips WP-style duplicate suffixes ("-1", "-copy", "-copy-2") and
 * normalises encoding/case — the shapes where the target is unambiguous.
 *
 * Deliberately conservative: it never removes a meaningful trailing token, so
 * "spf-30" and "no-7" survive intact (only a suffix that follows a hyphen AND
 * is pure junk is dropped, and never the entire slug).
 */
export function canonicalSlug(raw: string): string | null {
  const cleaned = cleanSlug(raw);
  const stripped = cleaned.replace(JUNK_SUFFIX, '');
  // Never strip down to nothing, and never strip the only token: "/product/2"
  // has no meaningful canonical form, and "spf-30" must keep its 30.
  const candidate = stripped && stripped.includes('-') ? stripped : cleaned;
  return candidate !== raw ? candidate : null;
}

/** Meaningful tokens in a slug or product name, for similarity scoring. */
export function slugTokens(value: string): string[] {
  const raw = cleanSlug(value).split('-').filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (UNITS.has(t)) continue;
    // "100" in "100-ml" is a size; "30" in "spf-30" is the product. Drop the
    // number only when a unit follows it.
    if (/^\d+$/.test(t) && UNITS.has(raw[i + 1] ?? '')) { i++; continue; }
    if (t.length > 1 && !STOPWORDS.has(t)) out.push(t);
  }
  return out;
}

/**
 * 0..1 overlap between two token sets, normalised by the LONGER set so that a
 * short slug cannot score highly against a long one just by being a subset
 * ("cream" vs "golden-pearl-brightening-rice-cream" is 0.2, not 1.0).
 */
export function tokenScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let hits = 0;
  for (const t of new Set(a)) if (setB.has(t)) hits++;
  return hits / Math.max(new Set(a).size, setB.size);
}

export interface Rankable {
  slug: string;
  /** Extra text to match against — product name, brand, category. */
  haystack?: string;
}

export interface RankedMatch<T> {
  item: T;
  score: number;
}

/**
 * Rank candidates against a missed slug, best first. Anything scoring below
 * `minScore` is dropped, so an unrelated 404 returns an empty list rather than
 * a page of noise.
 */
export function rankCandidates<T extends Rankable>(
  missingSlug: string,
  candidates: T[],
  { limit = 6, minScore = 0.25 }: { limit?: number; minScore?: number } = {},
): Array<RankedMatch<T>> {
  const needle = slugTokens(missingSlug);
  if (needle.length === 0) return [];

  const scored: Array<RankedMatch<T>> = [];
  for (const c of candidates) {
    // Score against the slug and against the free text separately, keeping the
    // better of the two: a product whose slug was rewritten still matches on
    // its name, and vice versa.
    const bySlug = tokenScore(needle, slugTokens(c.slug));
    const byText = c.haystack ? tokenScore(needle, slugTokens(c.haystack)) : 0;
    const score = Math.max(bySlug, byText);
    if (score >= minScore) scored.push({ item: c, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** The human-readable search phrase a missed slug implies, e.g.
 *  "/brand/golden-pearl" → "golden pearl". Empty when nothing usable is left. */
export function slugToQuery(slug: string): string {
  return slugTokens(slug).join(' ');
}
