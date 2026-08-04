// ============================================================================
// Merchandising engine — the ONE place that decides which product fills which
// homepage slot, and why. Designed from the 2026-08-04 curation audit and its
// adversarial review; every rule here has a one-sentence answer to "why is
// this product here?", surfaced verbatim in Admin → Homepage preview.
//
// Doctrine (see the audit):
//  1. One score, one job: the nightly popularity cron is the single brain;
//     rails read denormalized columns, never query-time analytics.
//  2. Every rail = eligibility → ordering → rotation → dedupe, from shared
//     helpers, so no rail can forget the stock filter or double-place a tile.
//  3. Pins are overrides with guardrails (the admin health card nags), never
//     requirements.
//  4. Low order volume → decay + blend, never raw sales rank.
//
// Allocation runs in PRIORITY order — Featured → Best Sellers → Trending →
// Sale → New In → K-Beauty → Wellness — NOT render order. The adversarial
// review's sharpest catch: deduping in render order hands a sub-30-day top
// seller to New In and strips the Best Sellers rail of its best products
// exactly during sales. Demand rails must never yield to recency/discount
// rails; the page then renders the allocated rails in visual order.
// ============================================================================

import type { Product } from '@/types';
import { dailyRotation } from '@/lib/rotation';

/** Minimum trend_score for the Trending rail. The cron sprays small
 *  fractional credit widely (search attribution, decayed views); "a few real
 *  views" is the floor for calling something momentum. */
export const TREND_GATE = 3;

/** Max owner pins occupying fixed Best Sellers slots; the rest rotate on
 *  decayed sales so the rail stays honest. Extra pins surface in the admin
 *  health card rather than silently vanishing. */
export const BESTSELLER_PIN_CAP = 2;

export interface RailTile {
  product: Product;
  /** One plain sentence for the admin preview: why this tile, this slot. */
  reason: string;
}

export interface HomepageRails {
  featured: RailTile[];
  bestSellers: RailTile[];
  trending: RailTile[];
  sale: RailTile[];
  newIn: RailTile[];
  kBeauty: RailTile[];
  wellnessRail: RailTile[];
}

export interface RailInputs {
  /** ALL is_featured + published + purchasable rows, demand-ordered. */
  featuredPool: Product[];
  /** Top sellers pool of 8: pins first, then decayed sales order. */
  sellersPool: Product[];
  /** Trend-ordered pool (12), zero-score rows included. */
  trendingPool: Product[];
  /** Deepest live discounts first (discount_pct DESC, min 10%). */
  salePool: Product[];
  /** Newest first within the 30-day window (24 fetched). */
  newInPool: Product[];
  /** K-Beauty brand pool (24), demand-ordered. */
  kBeautyPool: Product[];
  /** Full wellness set, demand-ordered. */
  wellnessPool: Product[];
  saleActive: boolean;
}

const demand = (p: Product) => Number(p.popularity_score ?? 0);

/** Freshness-last tiebreak: demand first, then newest, so zero-signal
 *  products order by recency instead of arbitrary Postgres order. */
export function byDemandThenFresh(a: Product, b: Product): number {
  const d = demand(b) - demand(a);
  if (d !== 0) return d;
  return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
}

/** At most `cap` products per brand, keeping the incoming order — stops a
 *  single restocked brand monopolising the K-Beauty rail. */
export function capPerBrand(pool: Product[], cap = 2): Product[] {
  const counts = new Map<string, number>();
  return pool.filter(p => {
    const b = (p.brand ?? '').toLowerCase();
    const n = counts.get(b) ?? 0;
    if (n >= cap) return false;
    counts.set(b, n + 1);
    return true;
  });
}

/** Compose every homepage rail from pre-fetched pools. Pure given
 *  (inputs, PKT day): dailyRotation is deterministic per day, which is what
 *  makes the admin "Today's homepage" preview honest. */
export function composeHomepageRails(inp: RailInputs): HomepageRails {
  const seen = new Set<string>();
  const claim = (tiles: RailTile[]) => { for (const t of tiles) seen.add(t.product.id); return tiles; };
  const unseen = (pool: Product[]) => pool.filter(p => !seen.has(p.id));

  // ── 1. Featured: owner-flagged, best 12 by demand form the daily-rotation
  //      pool. Fill-up (when <4 flagged) comes from the trending pool by
  //      demand, EXCLUDING the whole fetched sellers pool — a rotated-out
  //      best seller must not masquerade as "Featured".
  const sellerIds = new Set(inp.sellersPool.map(p => p.id));
  const flaggedPool = [...inp.featuredPool].sort(byDemandThenFresh).slice(0, 12);
  const flaggedPicks = dailyRotation(flaggedPool, 4, 'featured');
  const fillPicks = flaggedPicks.length >= 4 ? [] :
    [...inp.trendingPool].sort(byDemandThenFresh)
      .filter(p => !sellerIds.has(p.id) && !flaggedPicks.some(f => f.id === p.id))
      .slice(0, 4 - flaggedPicks.length);
  const featured = claim([
    ...flaggedPicks.map(p => ({ product: p, reason: `Owner-flagged featured; daily rotation over the ${flaggedPool.length} flagged products.` })),
    ...fillPicks.map(p => ({ product: p, reason: 'Fill-up: highest shopper demand outside the Best Sellers pool (fewer than 4 products are flagged).' })),
  ]);

  // ── 2. Best Sellers: pins (max 2) hold fixed slots; remaining slots rotate
  //      daily over the top 6 non-pinned by decayed sales.
  const pins = inp.sellersPool.filter(p => p.is_bestseller && !seen.has(p.id)).slice(0, BESTSELLER_PIN_CAP);
  const organicPool = unseen(inp.sellersPool).filter(p => !pins.includes(p)).slice(0, 6);
  const organic = dailyRotation(organicPool, 4 - pins.length, 'bestsellers');
  const bestSellers = claim([
    ...pins.map(p => ({ product: p, reason: 'Owner-pinned best seller (fixed slot; up to two pins lead the rail).' })),
    ...organic.map(p => ({ product: p, reason: 'Most units sold recently (recency-weighted), rotating daily within the top sellers.' })),
  ]);

  // ── 3. Trending: real momentum only (gate), never anything from the
  //      fetched sellers pool — "trending" must not be a rotated-out seller.
  const trending = claim(
    dailyRotation(
      unseen(inp.trendingPool).filter(p => !sellerIds.has(p.id) && Number(p.trend_score ?? 0) >= TREND_GATE),
      4, 'trending',
    ).map(p => ({ product: p, reason: `Momentum this week (views, carts, searches) of ${Math.round(Number(p.trend_score ?? 0))}, not already a best seller.` })),
  );

  // ── 4. Sale (only while switched on): deepest live discounts.
  const sale = inp.saleActive
    ? claim(unseen(inp.salePool).slice(0, 8).map(p => {
        const pct = p.original_price ? Math.round(100 * (p.original_price - p.price) / p.original_price) : 0;
        return { product: p, reason: `${pct}% off — deepest live discounts lead, minimum 10%.` };
      }))
    : [];

  // ── 5. New In: newest within 30 days, minus everything already placed.
  const newIn = claim(unseen(inp.newInPool).slice(0, 4).map(p =>
    ({ product: p, reason: 'Added within the last 30 days, newest first, not shown in a rail above.' })));

  // ── 6. K-Beauty: max two per brand by demand, rotating daily.
  const kBeauty = claim(
    dailyRotation(capPerBrand(unseen([...inp.kBeautyPool].sort(byDemandThenFresh)), 2), 4, 'kbeauty')
      .map(p => ({ product: p, reason: 'Curated Korean brand, max two per brand, daily rotation by shopper demand.' })),
  );

  // ── 7. Wellness rail: top 16 by demand, rotating 8 daily.
  const wellnessRail = claim(
    dailyRotation(unseen([...inp.wellnessPool].sort(byDemandThenFresh)).slice(0, 16), 8, 'wellness')
      .map(p => ({ product: p, reason: 'Most-engaged wellness products, daily rotation within the top 16.' })),
  );

  return { featured, bestSellers, trending, sale, newIn, kBeauty, wellnessRail };
}

// ── Blog hero ───────────────────────────────────────────────────────────────

export interface BlogHeroPost { id: string; date: string; featured?: boolean }

/** The blog hero: the featured post if its editorial date is within the last
 *  60 days (and not in the future), else the newest non-future post. One rule
 *  shared by the blog page and the homepage journal row, so the two surfaces
 *  can never disagree about the top post. */
export function pickBlogHero<T extends BlogHeroPost>(posts: T[], todayISO: string): T | null {
  const current = posts.filter(p => (p.date ?? '') <= todayISO);
  const floor = new Date(new Date(todayISO + 'T00:00:00Z').getTime() - 60 * 86_400_000)
    .toISOString().slice(0, 10);
  const feat = current.find(p => p.featured && p.date >= floor);
  return feat ?? current[0] ?? null;
}
