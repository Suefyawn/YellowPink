// Picks the products a blog post page shows in "Recommended in this guide"
// and "Mentioned in This Article". Previously this was a flat category-taxon
// slice ordered by product id, so every post in a broad bucket (Wellness
// alone spans Women's/Men's Health, Immunity, Bone & Joint, Heart Health,
// Digestive, Kids) showed the exact same first two or three products
// regardless of what the article was actually about, e.g. every Wellness
// post recommending baby colic drops.
//
// The most reliable signal for "what is this post actually about" is the
// `/product/SLUG` links already authored into the body HTML (the house
// convention for every post written or fixed this session), so that's tried
// first. A plain-text brand/name mention is a secondary signal for older
// posts that predate that convention. Only when neither finds anything does
// this fall back to the category-wide pool, rotated per post so a true
// fallback case doesn't always land on the same first N products either.

import type { Product } from '@/types';
import { stripBrandPrefix } from './product-display';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ');
}

/** Slugs explicitly linked in the body, in first-appearance order, e.g.
 *  `<a class="blog-product-link" href="/product/repro-m">Repro-M</a>`. */
function linkedSlugsInOrder(html: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of html.matchAll(/href="\/product\/([a-z0-9-]+)"/g)) {
    if (!seen.has(m[1])) { seen.add(m[1]); out.push(m[1]); }
  }
  return out;
}

/** True if the product's brand+name (or bare name) appears as a whole phrase
 *  in the haystack, the same word-boundary-safe matching linkProductMentions
 *  uses so "Cee" doesn't match inside "Coffee". */
function isMentioned(haystack: string, product: Product): boolean {
  if (!product.name) return false;
  const cleanName = stripBrandPrefix(product.brand, product.name).trim();
  const phrases = [product.brand ? `${product.brand} ${cleanName}`.trim() : '', cleanName].filter(p => p.length >= 4);
  return phrases.some(phrase => {
    const pattern = new RegExp(`(^|[^A-Za-z0-9])(${escapeRegExp(phrase)})(?=$|[^A-Za-z0-9])`, 'i');
    return pattern.test(haystack);
  });
}

/** Cheap deterministic hash so the category-only fallback varies by post
 *  instead of always handing back the same id-sorted first N products. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function selectRelatedProducts(
  post: { slug: string; title: string; excerpt?: string | null; body?: string | null },
  /** The whole catalogue, so a post that names or links a product outside
   *  its own broad category bucket still matches it (e.g. a Hair post
   *  linking a Wellness-taxon supplement). */
  allProducts: Product[],
  /** Used only when nothing is explicitly linked or named, the category-
   *  scoped pool computed by the caller. */
  fallbackPool: Product[],
  limit = 3,
): Product[] {
  const body = post.body ?? '';

  const bySlug = new Map(allProducts.map(p => [p.slug, p]));
  const linked = linkedSlugsInOrder(body).map(slug => bySlug.get(slug)).filter((p): p is Product => Boolean(p));
  if (linked.length > 0) return linked.slice(0, limit);

  const haystack = `${post.title} ${post.excerpt ?? ''} ${stripHtml(body)}`;
  const mentioned = allProducts.filter(p => isMentioned(haystack, p));
  if (mentioned.length > 0) return mentioned.slice(0, limit);

  // No explicit link or mention found (a generic listicle, or the
  // catalogue product name doesn't appear verbatim), fall back to the
  // category pool but rotate the starting point per post so different
  // posts in the same broad bucket don't all land on the identical first N
  // products.
  if (fallbackPool.length === 0) return [];
  if (fallbackPool.length <= limit) return fallbackPool;
  const offset = hashString(post.slug) % fallbackPool.length;
  const rotated = [...fallbackPool.slice(offset), ...fallbackPool.slice(0, offset)];
  return rotated.slice(0, limit);
}
