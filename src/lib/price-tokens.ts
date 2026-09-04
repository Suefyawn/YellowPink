// Live editorial tokens. Editorial copy (blog bodies, brand/collection
// content_html, FAQ answers) writes a token instead of a hardcoded value;
// the token renders its CURRENT value at page render.
//
// `[[price:product-slug]]` was born out of the 11 Aug price audit, which left
// ~70 stale price quotes across ~50 posts (worst case: a post quoting
// Rs 1,999 for a product that had moved to Rs 5,999). Hardcoded prices rot on
// every repricing; tokens cannot.
//
// `[[month]]` / `[[year]]` exist for the same reason, found by the 4 Sep
// content fact-check: "CeraVe Prices in Pakistan (September 2026)" and
// "Pregnancy Test Prices in Pakistan (August 2026)" were hand-typed, so a
// freshness signal shoppers and Google both read silently went stale (the
// pregnancy-test heading was already a month behind when it was found).
// Pages are ISR on a 1-hour window, so a rendered month catches up with the
// real calendar within an hour of rollover, sooner if a write busts the page.

import { PK_TZ } from './dates';

interface PricedProduct { slug: string; price: number | null }

// One pass over every supported token. Keep the alternation in sync with the
// handler in renderContentTokens below.
const TOKEN = /\[\[(?:price:([a-z0-9-]+)|month|year)\]\]/g;

export function formatRs(price: number): string {
  return 'Rs ' + Math.round(price).toLocaleString('en-US');
}

/** "September 2026" in Pakistan time — the store's own calendar, so a post
 *  never reads a month behind for a Karachi shopper because the server sat
 *  in UTC. */
export function currentMonthLabel(now: Date = new Date()): string {
  return now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: PK_TZ });
}

export function currentYearLabel(now: Date = new Date()): string {
  return now.toLocaleDateString('en-GB', { year: 'numeric', timeZone: PK_TZ });
}

const DATE_TOKEN = /\[\[(month|year)\]\]/g;

/** Date tokens only, for headlines. A title never carries a price token (a
 *  price in a headline reads badly and rots on a different clock), so this
 *  needs no product list and can be applied at the data layer.
 *
 *  Exists because 151 of 261 post titles hard-coded "2026" and would all have
 *  gone wrong at once on 1 Jan 2027. */
export function renderDateTokens(text: string | null | undefined, now: Date = new Date()): string {
  if (!text || !text.includes('[[')) return text ?? '';
  return text.replace(DATE_TOKEN, (_m, kind: string) =>
    kind === 'month' ? currentMonthLabel(now) : currentYearLabel(now));
}

/** Resolve the date tokens in a post's headline fields.
 *
 *  Applied in the loaders (getBlogPosts, getBlogPostBySlug, …) rather than at
 *  each of the ~20 places a title is rendered, so the H1, the listing tiles,
 *  the <title>, the Article JSON-LD headline, breadcrumbs, search, llms.txt
 *  and the sitemap page all get the resolved value without having to remember.
 *  Missing one consumer is exactly how raw {{tokens}} reached Google in the
 *  CMS page JSON-LD earlier the same day.
 *
 *  The admin edits rows through supabaseAdmin, which does not pass through
 *  here, so the editor still sees and saves the literal [[year]]. That is
 *  deliberate: you want to edit the token, not a snapshot of it. */
export function withRenderedDates<T extends { title?: string | null; seo_title?: string | null }>(
  post: T,
  now: Date = new Date(),
): T {
  const title = post.title == null ? post.title : renderDateTokens(post.title, now);
  const seo = post.seo_title == null ? post.seo_title : renderDateTokens(post.seo_title, now);
  if (title === post.title && seo === post.seo_title) return post;
  return { ...post, title, seo_title: seo };
}

/** Replace every supported token with its live value.
 *  An unknown product slug or a null price renders as an empty string (the
 *  sentence should be written to survive that) — never the raw token, which
 *  would read as a bug to the shopper. */
export function renderContentTokens(
  text: string | null | undefined,
  products: PricedProduct[],
  now: Date = new Date(),
): string {
  if (!text || !text.includes('[[')) return text ?? '';
  const bySlug = new Map(products.map(p => [p.slug, p.price]));
  return text.replace(TOKEN, (match, slug: string | undefined) => {
    if (match === '[[month]]') return currentMonthLabel(now);
    if (match === '[[year]]') return currentYearLabel(now);
    const price = slug === undefined ? undefined : bySlug.get(slug);
    return price == null ? '' : formatRs(price);
  });
}

/** Convenience for FAQ arrays: renders tokens in answers (and questions,
 *  though tokens in questions are rare) so the visible accordion and the
 *  FAQPage JSON-LD both carry live values. */
export function renderFaqTokens<T extends { q: string; a: string }>(
  faqs: T[] | null | undefined,
  products: PricedProduct[],
  now: Date = new Date(),
): { q: string; a: string }[] | null {
  if (!Array.isArray(faqs)) return null;
  return faqs.map(f => ({
    q: renderContentTokens(f.q, products, now),
    a: renderContentTokens(f.a, products, now),
  }));
}
