// Turns a missed URL into something worth clicking.
//
// The not-found page is deliberately STATIC (reading a dynamic API in the root
// not-found boundary forces every route into dynamic rendering and killed the
// sitewide ISR cache — see the note in src/app/not-found.tsx). So it cannot
// know which path the visitor missed. The client asks this route instead.
//
// The response never changes the HTTP status of the 404 itself. A page that
// does not exist must keep answering 404: dressing it up as a 200 is a soft
// 404, which Google penalises and which hides broken links from our own
// Broken-links report. We only make the BODY useful.

import { NextRequest, NextResponse } from 'next/server';
import { getProducts } from '@/lib/supabase';
import { brandSlug, brandsFromProducts } from '@/lib/brands';
import { rankCandidates, slugToQuery, cleanSlug } from '@/lib/near-match';
import { suggestLimiter, ipFromHeaders } from '@/lib/ratelimit';

export const runtime = 'nodejs';

/** Paths that are noise, not a lost shopper: scanners probing for WordPress,
 *  env files and admin panels. Answering them costs a catalogue read. */
const NOISE = /(^\/?(wp-|xmlrpc|\.env|\.git|admin|phpmyadmin|vendor\/))|\.(php|asp|aspx|jsp|cgi|sql|bak|zip|yml|ini)$/i;

export interface SuggestResponse {
  /** The phrase we think they were after, e.g. "golden pearl". Empty if none. */
  query: string;
  products: Array<{
    slug: string; name: string; brand: string | null;
    price: number; originalPrice: number | null; imageUrl: string | null;
  }>;
  /** A live brand page matching the missed path, when there is one. */
  brand: { name: string; slug: string; count: number } | null;
}

const EMPTY: SuggestResponse = { query: '', products: [], brand: null };

export async function GET(req: NextRequest) {
  const rl = await suggestLimiter.limit(ipFromHeaders(req.headers));
  if (!rl.success) return NextResponse.json(EMPTY, { status: 429 });

  const path = req.nextUrl.searchParams.get('path') ?? '';
  if (!path || path.length > 512 || NOISE.test(path)) return NextResponse.json(EMPTY);

  // Score against the whole path, not just the last segment: "/brand/cerave"
  // and "/product/cerave-cleanser" both carry the useful words, and "brand" /
  // "product" are short enough to be dropped as noise by the tokenizer only if
  // we strip them explicitly.
  const slugPart = cleanSlug(
    path.replace(/^\/+/, '').replace(/^(product|brand|collection|category|tag|blog|page|author)\//, ''),
  );
  const query = slugToQuery(slugPart);
  if (!query) return NextResponse.json(EMPTY);

  const products = await getProducts().catch(() => []);
  if (products.length === 0) return NextResponse.json({ ...EMPTY, query });

  const ranked = rankCandidates(
    slugPart,
    products.map(p => ({
      slug: p.slug,
      haystack: [p.brand, p.name, p.category].filter(Boolean).join(' '),
      product: p,
    })),
    { limit: 4 },
  );

  // A brand archive is a better landing page than four loose products when the
  // path clearly names a brand we still stock.
  const brandHit = brandsFromProducts(products).find(b => {
    const s = brandSlug(b.name);
    return s === slugPart || slugPart.startsWith(`${s}-`) || slugPart.endsWith(`-${s}`);
  }) ?? null;

  const body: SuggestResponse = {
    query,
    brand: brandHit ? { name: brandHit.name, slug: brandSlug(brandHit.name), count: brandHit.count } : null,
    products: ranked.map(({ item }) => ({
      slug: item.product.slug,
      name: item.product.name,
      brand: item.product.brand ?? null,
      price: item.product.price,
      originalPrice: item.product.original_price ?? null,
      imageUrl: item.product.image_url ?? null,
    })),
  };

  return NextResponse.json(body, {
    // Same-path 404s repeat (one bad backlink, many visitors), and the
    // catalogue changes slowly. Cache at the edge so a scan can't turn into a
    // catalogue read per request.
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
