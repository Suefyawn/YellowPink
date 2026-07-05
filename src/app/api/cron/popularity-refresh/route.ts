// ============================================================================
// Vercel Cron: refresh products.popularity_score from real storefront demand.
//
// Signal (trailing window, storefront + human traffic only):
//   * PostHog view_item + add_to_cart counts, per product_id (last 30 days)
//   * real units sold from orders.items                      (last 60 days)
// blended as  views*1 + carts*4 + sales*12  so intent-to-buy outweighs a
// glance, and a real sale outweighs everything. The homepage "Popular right
// now" rail (getBestsellers) orders by this, so it reflects what shoppers are
// actually looking at and buying.
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
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PH_PROJECT_ID = 429225;
const PH_BASE = 'https://us.posthog.com';

// Weights: a sale counts most, then an add-to-cart (strong intent), then a view.
const W_VIEW = 1;
const W_CART = 4;
const W_SALE = 12;

const VIEW_WINDOW_DAYS = 30;
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

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // ── units sold per product from recent orders ──
  const sales = new Map<string, number>();
  const { data: orders } = await sb
    .from('orders')
    .select('items')
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

  // ── blend into a score per product ──
  const scores = new Map<string, number>();
  const ids = new Set<string>([...demand.keys(), ...sales.keys()]);
  for (const id of ids) {
    const d = demand.get(id);
    const score =
      (d?.views ?? 0) * W_VIEW +
      (d?.carts ?? 0) * W_CART +
      (sales.get(id) ?? 0) * W_SALE;
    if (score > 0) scores.set(id, score);
  }

  // Decay yesterday's scores to 0 first, then write the fresh ones, so a
  // product whose demand dried up falls out of the rail instead of sticking.
  await sb.from('products').update({ popularity_score: 0 }).neq('popularity_score', 0);
  let written = 0;
  for (const [id, score] of scores) {
    const { error } = await sb.from('products').update({ popularity_score: score }).eq('id', id);
    if (!error) written++;
  }

  return NextResponse.json({
    ok: true,
    scored: written,
    signals: { products_with_demand: demand.size, products_with_sales: sales.size },
    posthog: process.env.POSTHOG_PERSONAL_API_KEY ? 'queried' : 'skipped (no key)',
  });
}
