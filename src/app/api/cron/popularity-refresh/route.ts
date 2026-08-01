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
  const sql = `
    SELECT properties.product_id AS pid,
           countIf(event = 'view_item')   AS views,
           countIf(event = 'add_to_cart') AS carts
    FROM events
    WHERE event IN ('view_item', 'add_to_cart')
      AND timestamp >= now() - interval ${VIEW_WINDOW_DAYS} day
      AND properties.product_id != ''
      AND coalesce(properties.\`$virt_is_bot\`, false) = false
      AND NOT startsWith(coalesce(properties.\`$pathname\`, ''), '/admin')
    GROUP BY pid`;
  try {
    const res = await fetch(`${PH_BASE}/api/projects/${PH_PROJECT_ID}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql } }),
      cache: 'no-store',
    });
    if (!res.ok) return out;
    const rows = ((await res.json()).results ?? []) as unknown[][];
    for (const r of rows) {
      const pid = String(r[0] ?? '');
      if (!pid) continue;
      out.set(pid, { views: Number(r[1]) || 0, carts: Number(r[2]) || 0 });
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
  const sql = `
    SELECT lower(trim(properties.query)) AS q, count() AS n
    FROM events
    WHERE event = 'search'
      AND timestamp >= now() - interval ${SEARCH_WINDOW_DAYS} day
      AND coalesce(properties.query, '') != ''
      AND coalesce(properties.\`$virt_is_bot\`, false) = false
      AND NOT startsWith(coalesce(properties.\`$pathname\`, ''), '/admin')
    GROUP BY q ORDER BY n DESC LIMIT 80`;
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
    terms = rows.map(r => ({ q: String(r[0] ?? ''), n: Number(r[1]) || 0 })).filter(t => t.q && t.n > 0);
  } catch {
    return out;
  }
  // Resolve each term → its top product match (service role bypasses the anon
  // RPC revoke). Credit the term's search count to that product.
  for (const t of terms) {
    try {
      const { data } = await sb.rpc('search_products' as never, { p_query: t.q, p_limit: 1 } as never);
      const top = ((data ?? []) as { id?: string }[])[0];
      if (top?.id) out.set(top.id, (out.get(top.id) ?? 0) + t.n);
    } catch {
      /* skip unmatchable term */
    }
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
  const sales = new Map<string, number>();
  // Only orders that really sold: archived and no-revenue states out, else a
  // refused/cancelled parcel could crown a storefront "best seller"
  // (2026-08-01 audit).
  const { data: orders } = await sb
    .from('orders')
    .select('items')
    .is('archived_at', null)
    .not('status', 'in', '(cancelled,payment_failed,payment_pending,refunded,returned)')
    .gte('created_at', new Date(Date.now() - SALES_WINDOW_MS).toISOString())
    .limit(2000);
  for (const o of (orders ?? []) as { items: OrderItem[] | null }[]) {
    for (const it of o.items ?? []) {
      if (!it.id) continue;
      sales.set(it.id, (sales.get(it.id) ?? 0) + (Number(it.qty) || 1));
    }
  }

  // ── views + carts per product from PostHog ──
  const demand = await phDemand();

  // ── on-site search demand per product (query → top product match) ──
  const searches = await phSearchDemand(sb);

  // ── per-product signals: the blended score (for ordering + the Popular
  //    badge), the trend-only score (Trending rail), and units sold (Best
  //    Sellers rail). Kept separate so the two homepage rails can differ. ──
  interface Sig { score: number; trend: number; units: number }
  const sig = new Map<string, Sig>();
  const ids = new Set<string>([...demand.keys(), ...sales.keys(), ...searches.keys()]);
  for (const id of ids) {
    const d = demand.get(id);
    const units = sales.get(id) ?? 0;
    const search = searches.get(id) ?? 0;
    // Trend (Trending / "most searched" rail) = views + carts + on-site
    // searches; the blended score adds real sales on top.
    const trend = (d?.views ?? 0) * W_VIEW + (d?.carts ?? 0) * W_CART + search * W_SEARCH;
    const score = trend + units * W_SALE;
    if (score > 0) sig.set(id, { score, trend, units });
  }

  // Top demand tier gets the automatic "Popular" badge (is_popular). Capped so
  // the badge stays meaningful (a scarce signal, not on half the catalogue).
  const POPULAR_TOP_N = 12;
  const popularIds = new Set(
    [...sig.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, POPULAR_TOP_N).map(([id]) => id),
  );

  // Decay every non-default row back to zero/false first, then write the fresh
  // signals, so a product whose demand dried up drops off the rails and loses
  // its badge instead of sticking.
  await sb.from('products')
    .update({ popularity_score: 0, trend_score: 0, units_sold: 0, is_popular: false })
    .or('popularity_score.neq.0,trend_score.neq.0,units_sold.neq.0,is_popular.eq.true');

  let written = 0;
  for (const [id, s] of sig) {
    const { error } = await sb.from('products')
      .update({ popularity_score: s.score, trend_score: s.trend, units_sold: s.units, is_popular: popularIds.has(id) })
      .eq('id', id);
    if (!error) written++;
  }

  return NextResponse.json({
    ok: true,
    scored: written,
    popular: popularIds.size,
    signals: { products_with_demand: demand.size, products_with_sales: sales.size, products_with_searches: searches.size },
    posthog: process.env.POSTHOG_PERSONAL_API_KEY ? 'queried' : 'skipped (no key)',
  });
}
