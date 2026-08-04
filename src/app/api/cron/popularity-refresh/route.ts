// ============================================================================
// Vercel Cron: refresh products.popularity_score from real storefront demand.
//
// Signal (trailing window, storefront + human traffic only):
//   * PostHog view_item + add_to_cart counts, per product_id (last 30 days)
//   * PostHog on-site `search` events → top product match (last 30 days)
//   * real units sold from orders.items                      (last 60 days)
// blended as  views*1 + searches*3 + carts*4 + sales*12  so intent-to-buy
// outweighs a glance, a real sale outweighs everything, and products shoppers
// actively search for on the store count too (not just what they clicked). The
// homepage Best Sellers rail orders by units sold; the Trending / "most
// searched" rail orders by trend (views + carts + searches).
//
// Guardrails baked in elsewhere:
//   * manual is_bestseller still leads the rail (owner override) — this score
//     only orders products *underneath* the flagged ones (see getBestsellers).
//   * the homepage keeps dedicated Wellness / K-Beauty sections, so a
//     makeup-heavy popular rail never starves those ranges of a slot.
//
// Fanned out from /api/cron/daily. Degrades gracefully: with no PostHog key it
// still scores from sales alone; with neither signal it no-ops.
//
// Required env:
//   CRON_SECRET                , Bearer secret shared with vercel.json
//   SUPABASE_SERVICE_ROLE_KEY  , to write scores past RLS
//   POSTHOG_PERSONAL_API_KEY   , view/cart signal (optional; sales-only if absent)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PH_PROJECT_ID = 429225;
const PH_BASE = 'https://us.posthog.com';

// Weights: a sale counts most, then an add-to-cart (strong intent), then an
// on-site search (explicit intent — someone typed the product/term), then a
// passive view.
const W_VIEW = 1;
const W_SEARCH = 3;
const W_CART = 4;
const W_SALE = 12;

const VIEW_WINDOW_DAYS = 30;
const SEARCH_WINDOW_DAYS = 30;
const SALES_WINDOW_MS = 60 * 86_400_000;

// Recency decay (merchandising engine, 2026-08-04): each event's weight
// halves every DECAY_HALF_LIFE days, so the ordering reflects momentum, not
// a flat 30/60-day sum. units_sold stays the LITERAL 60-day count (it feeds
// the PDP "N+ sold" proof and must remain honest); the decayed sales value
// lands in the separate sales_score column, used only for ordering.
const ENGAGEMENT_HALF_LIFE_DAYS = 14;
const SALES_HALF_LIFE_DAYS = 30;
const decay = (ageDays: number, halfLife: number) => Math.pow(0.5, Math.max(0, ageDays) / halfLife);

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

interface OrderItem { id?: string; qty?: number }

/** Per-product view + cart counts from PostHog. Empty map if the key is unset
 *  or the query fails (sales alone still produce a useful score). */
async function phDemand(): Promise<Map<string, { views: number; carts: number }>> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const out = new Map<string, { views: number; carts: number }>();
  if (!apiKey) return out;
  // Storefront (not /admin) + human traffic only, keyed by product_id.
  // Grouped per day so each day's counts can be recency-decayed in JS.
  const sql = `
    SELECT properties.product_id AS pid,
           toDate(timestamp) AS d,
           countIf(event = 'view_item')   AS views,
           countIf(event = 'add_to_cart') AS carts
    FROM events
    WHERE event IN ('view_item', 'add_to_cart')
      AND timestamp >= now() - interval ${VIEW_WINDOW_DAYS} day
      AND properties.product_id != ''
      AND coalesce(properties.\`$virt_is_bot\`, false) = false
      AND NOT startsWith(coalesce(properties.\`$pathname\`, ''), '/admin')
    GROUP BY pid, d`;
  try {
    const res = await fetch(`${PH_BASE}/api/projects/${PH_PROJECT_ID}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql } }),
      cache: 'no-store',
    });
    if (!res.ok) return out;
    const rows = ((await res.json()).results ?? []) as unknown[][];
    const now = Date.now();
    for (const r of rows) {
      const pid = String(r[0] ?? '');
      if (!pid) continue;
      const ageDays = (now - new Date(String(r[1])).getTime()) / 86_400_000;
      const w = decay(ageDays, ENGAGEMENT_HALF_LIFE_DAYS);
      const cur = out.get(pid) ?? { views: 0, carts: 0 };
      cur.views += (Number(r[2]) || 0) * w;
      cur.carts += (Number(r[3]) || 0) * w;
      out.set(pid, cur);
    }
  } catch {
    /* sales-only fallback */
  }
  return out;
}

/** On-site search demand attributed to products. Pulls `search` events (query +
 *  count) from PostHog, then resolves each query to the product it best matches
 *  via the search_products RPC, crediting that query's searches to the top
 *  match. So a product lots of shoppers *search for* on the store gains trend +
 *  popularity even before it sells. Empty map without a PostHog key.
 *  eslint-disable-next-line @typescript-eslint/no-explicit-any */
async function phSearchDemand(sb: SupabaseClient): Promise<Map<string, number>> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const out = new Map<string, number>();
  if (!apiKey) return out;
  // Per-day so search decays like every other engagement signal — a flat
  // 30-day sum would otherwise become the dominant stale term in trend_score.
  const sql = `
    SELECT lower(trim(properties.query)) AS q, toDate(timestamp) AS d, count() AS n
    FROM events
    WHERE event = 'search'
      AND timestamp >= now() - interval ${SEARCH_WINDOW_DAYS} day
      AND coalesce(properties.query, '') != ''
      AND coalesce(properties.\`$virt_is_bot\`, false) = false
      AND NOT startsWith(coalesce(properties.\`$pathname\`, ''), '/admin')
    GROUP BY q, d ORDER BY n DESC LIMIT 400`;
  let terms: { q: string; n: number }[] = [];
  try {
    const res = await fetch(`${PH_BASE}/api/projects/${PH_PROJECT_ID}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql } }),
      cache: 'no-store',
    });
    if (!res.ok) return out;
    const rows = ((await res.json()).results ?? []) as unknown[][];
    const now = Date.now();
    const byTerm = new Map<string, number>();
    for (const r of rows) {
      const q = String(r[0] ?? '');
      if (!q) continue;
      const ageDays = (now - new Date(String(r[1])).getTime()) / 86_400_000;
      byTerm.set(q, (byTerm.get(q) ?? 0) + (Number(r[2]) || 0) * decay(ageDays, ENGAGEMENT_HALF_LIFE_DAYS));
    }
    terms = [...byTerm.entries()].map(([q, n]) => ({ q, n })).filter(t => t.n > 0)
      .sort((a, b) => b.n - a.n).slice(0, 80);
  } catch {
    return out;
  }
  // Resolve terms → products (service role bypasses the anon RPC revoke).
  // Strong terms (≥5 decayed searches) split 0.6/0.25/0.15 across their top
  // three matches; weak terms stay winner-take-all so fractional credit
  // can't spray trend_score over half the catalog. Chunked concurrency keeps
  // 80 lookups well inside the job's time cap.
  const SPLIT_MIN = 5;
  const SPLIT_WEIGHTS = [0.6, 0.25, 0.15];
  const CHUNK = 10;
  for (let i = 0; i < terms.length; i += CHUNK) {
    await Promise.all(terms.slice(i, i + CHUNK).map(async t => {
      try {
        const wantSplit = t.n >= SPLIT_MIN;
        const { data } = await sb.rpc('search_products' as never, { p_query: t.q, p_limit: wantSplit ? 3 : 1 } as never);
        const matches = ((data ?? []) as { id?: string }[]).filter(m => m.id);
        if (!matches.length) return;
        if (!wantSplit) {
          out.set(matches[0].id!, (out.get(matches[0].id!) ?? 0) + t.n);
          return;
        }
        matches.slice(0, 3).forEach((m, j) => {
          out.set(m.id!, (out.get(m.id!) ?? 0) + t.n * SPLIT_WEIGHTS[j]);
        });
      } catch {
        /* skip unmatchable term */
      }
    }));
  }
  return out;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // ── units sold per product from recent orders ──
  // units = the honest literal count (PDP "N+ sold" proof); salesScore = the
  // recency-decayed value that orders the Best Sellers rail.
  const sales = new Map<string, { units: number; salesScore: number }>();
  // Only orders that really sold: archived and no-revenue states out, else a
  // refused/cancelled parcel could crown a storefront "best seller"
  // (2026-08-01 audit).
  const { data: orders } = await sb
    .from('orders')
    .select('items, created_at')
    .is('archived_at', null)
    .not('status', 'in', '(cancelled,payment_failed,payment_pending,refunded,returned)')
    .gte('created_at', new Date(Date.now() - SALES_WINDOW_MS).toISOString())
    .limit(2000);
  const nowMs = Date.now();
  for (const o of (orders ?? []) as { items: OrderItem[] | null; created_at: string }[]) {
    const w = decay((nowMs - new Date(o.created_at).getTime()) / 86_400_000, SALES_HALF_LIFE_DAYS);
    for (const it of o.items ?? []) {
      if (!it.id) continue;
      const qty = Number(it.qty) || 1;
      const cur = sales.get(it.id) ?? { units: 0, salesScore: 0 };
      cur.units += qty;
      cur.salesScore += qty * w;
      sales.set(it.id, cur);
    }
  }

  // ── views + carts per product from PostHog ──
  const demand = await phDemand();

  // ── on-site search demand per product (query → top product match) ──
  const searches = await phSearchDemand(sb);

  // ── per-product signals: the blended score (for ordering + the Popular
  //    badge), the trend-only score (Trending rail), and units sold (Best
  //    Sellers rail). Kept separate so the two homepage rails can differ. ──
  interface Sig { score: number; trend: number; units: number; salesScore: number }
  const sig = new Map<string, Sig>();
  const ids = new Set<string>([...demand.keys(), ...sales.keys(), ...searches.keys()]);
  for (const id of ids) {
    const d = demand.get(id);
    const sale = sales.get(id);
    const search = searches.get(id) ?? 0;
    // Trend (Trending rail) = decayed views + carts + on-site searches; the
    // blended score adds decayed sales on top. All engagement terms carry
    // recency decay, so both scores read as momentum, not lifetime totals.
    const trend = (d?.views ?? 0) * W_VIEW + (d?.carts ?? 0) * W_CART + search * W_SEARCH;
    const score = trend + (sale?.salesScore ?? 0) * W_SALE;
    if (score > 0 || (sale?.units ?? 0) > 0) {
      sig.set(id, { score, trend, units: sale?.units ?? 0, salesScore: sale?.salesScore ?? 0 });
    }
  }

  // Top demand tier gets the automatic "Popular" badge (is_popular). Capped so
  // the badge stays meaningful (a scarce signal, not on half the catalogue).
  const POPULAR_TOP_N = 12;
  const popularIds = new Set(
    [...sig.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, POPULAR_TOP_N).map(([id]) => id),
  );

  // One atomic transaction (update_product_scores, migration 2026-08-04):
  // scores written and stale rows zeroed together. The old zero-all-then-loop
  // left an all-zeros window a mid-run failure could freeze into place, and
  // an orphan id (deleted product still in events/orders) can't fail the
  // batch — UPDATE..FROM simply skips it.
  const payload = [...sig.entries()].map(([id, s]) => ({
    id,
    score: Math.round(s.score * 100) / 100,
    trend: Math.round(s.trend * 100) / 100,
    units: s.units,
    sales_score: Math.round(s.salesScore * 100) / 100,
    is_popular: popularIds.has(id),
  }));
  const { data: written, error: writeError } = await sb.rpc('update_product_scores' as never, { p_scores: payload } as never);
  if (writeError) {
    return NextResponse.json({ ok: false, error: writeError.message }, { status: 500 });
  }

  // Run stamp: the admin merchandising health card alarms when this is older
  // than 48h — the silent-skip failure mode was previously invisible.
  await sb.from('analytics_cache').upsert(
    { key: 'popularity_refresh_last_run', data: { at: new Date().toISOString(), scored: payload.length }, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  );

  return NextResponse.json({
    ok: true,
    scored: Number(written) || payload.length,
    popular: popularIds.size,
    signals: { products_with_demand: demand.size, products_with_sales: sales.size, products_with_searches: searches.size },
    posthog: process.env.POSTHOG_PERSONAL_API_KEY ? 'queried' : 'skipped (no key)',
  });
}
