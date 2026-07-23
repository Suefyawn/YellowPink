// ============================================================================
// Routine complements for skincare PDPs.
//
// The Frequently-Bought-Together widget is driven by real co-purchase data,
// which a young store barely has — so it rendered on almost no product pages.
// This module supplies the fallback: classify the anchor product into its
// routine step (the same keyword rules the Routine Finder quiz uses, so the
// two features can never disagree about what counts as a cleanser), then
// offer the best product from each OTHER step. A serum shopper is shown a
// cleanser, moisturiser and SPF: a complete routine, which is also the
// honest cross-sell.
//
// "Best" per step = shares the anchor's skin concern where detectable
// (an acne serum pairs with an acne-friendly cleanser, not a rich cream),
// then the store-wide popularity score as the tie-breaker.
// ============================================================================

import { SKINCARE_STEPS, CONCERN_RULES } from '@/lib/quiz';
import { taxonForCategory } from '@/lib/category-taxonomy';
import type { Product } from '@/types';

/** The routine step a product belongs to, or null when it isn't part of the
 *  cleanse/treat/moisturise/protect model (tools, makeup, wellness…). */
export function routineStepFor(p: Product): string | null {
  const name = p.name.toLowerCase();
  for (const step of SKINCARE_STEPS) {
    if (step.match.some(k => name.includes(k))) return step.key;
  }
  return null;
}

function isPurchasable(p: Product): boolean {
  return p.status === 'published' && (p.track_inventory === false || (p.stock ?? 0) > 0);
}

/** Concern keys whose keywords appear in the product's name/description. */
function concernsOf(p: Product): Set<string> {
  const text = `${p.name} ${p.description ?? ''}`.toLowerCase();
  const out = new Set<string>();
  for (const [key, rule] of Object.entries(CONCERN_RULES)) {
    if (rule.keywords.some(k => text.includes(k))) out.add(key);
  }
  return out;
}

/** Up to `max` complementary products, one per missing routine step, in
 *  routine order. Empty when the anchor isn't a skincare routine product. */
export function routineComplements(anchor: Product, catalog: Product[], max = 3): Product[] {
  if (taxonForCategory(anchor.category)?.key !== 'skincare') return [];
  const anchorStep = routineStepFor(anchor);
  if (!anchorStep) return [];

  const anchorConcerns = concernsOf(anchor);
  const candidates = catalog.filter(p =>
    p.id !== anchor.id
    && isPurchasable(p)
    && taxonForCategory(p.category)?.key === 'skincare',
  );

  // Complements shown in the order a routine is applied.
  const stepOrder = ['cleanse', 'treat', 'moisturize', 'protect'].filter(k => k !== anchorStep);

  const picks: Product[] = [];
  for (const stepKey of stepOrder) {
    if (picks.length >= max) break;
    let best: Product | null = null;
    let bestScore = -1;
    for (const p of candidates) {
      if (routineStepFor(p) !== stepKey) continue;
      const shared = [...concernsOf(p)].filter(c => anchorConcerns.has(c)).length;
      // Concern affinity dominates; popularity breaks ties. The popularity
      // term is scaled to stay below one concern hit so it can never
      // outvote suitability.
      const score = shared * 10 + Math.min(9, (p.popularity_score ?? 0) / 100);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (best) picks.push(best);
  }
  return picks;
}
