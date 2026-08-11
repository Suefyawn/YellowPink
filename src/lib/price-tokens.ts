// Live price tokens. Editorial copy (blog bodies, brand/collection
// content_html, FAQ answers) writes `[[price:product-slug]]` instead of a
// hardcoded figure; the token renders as the product's CURRENT price at
// page render. Born out of the 11 Aug price audit, which left ~70 stale
// price quotes across ~50 posts (worst case: a post quoting Rs 1,999 for
// a product that had moved to Rs 5,999). Hardcoded prices rot on every
// repricing; tokens cannot.

interface PricedProduct { slug: string; price: number | null }

const TOKEN = /\[\[price:([a-z0-9-]+)\]\]/g;

export function formatRs(price: number): string {
  return 'Rs ' + Math.round(price).toLocaleString('en-US');
}

/** Replace every [[price:slug]] with the product's current price.
 *  Unknown slug or null price renders as an empty string (the sentence
 *  should be written to survive that) — never the raw token, which would
 *  read as a bug to the shopper. */
export function renderPriceTokens(text: string | null | undefined, products: PricedProduct[]): string {
  if (!text || !text.includes('[[price:')) return text ?? '';
  const bySlug = new Map(products.map(p => [p.slug, p.price]));
  return text.replace(TOKEN, (_m, slug: string) => {
    const price = bySlug.get(slug);
    return price == null ? '' : formatRs(price);
  });
}

/** Convenience for FAQ arrays: renders tokens in answers (and questions,
 *  though prices in questions are rare) so the visible accordion and the
 *  FAQPage JSON-LD both carry live figures. */
export function renderFaqPriceTokens<T extends { q: string; a: string }>(
  faqs: T[] | null | undefined,
  products: PricedProduct[],
): { q: string; a: string }[] | null {
  if (!Array.isArray(faqs)) return null;
  return faqs.map(f => ({ q: renderPriceTokens(f.q, products), a: renderPriceTokens(f.a, products) }));
}
