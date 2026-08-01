// ============================================================================
// Weekly store health report — the data behind the Monday-morning owner email.
//
// One glanceable digest instead of five admin pages: orders + revenue vs the
// previous week, the shopper funnel and which storefront sections earn their
// slots (PostHog), abandoned checkouts, review supply, and Google indexing
// state. Every section is best-effort: a failed source renders as "not
// available" rather than sinking the whole report — the email must go out
// even on a bad-API morning.
//
// All week boundaries are Asia/Karachi days: "last week" is the 7 PKT days
// ending yesterday, compared against the 7 before that.
// ============================================================================

import { supabaseAdmin } from '@/lib/supabase';

const PH_PROJECT_ID = 429225;
const PH_BASE = 'https://us.posthog.com';

export interface WeeklyReport {
  periodLabel: string;
  orders: {
    count: number; prevCount: number;
    revenue: number; prevRevenue: number;
    aov: number;
    codShare: number | null;      // 0..1, null when no orders
    cancelled: number;
    topProducts: { name: string; units: number }[];
    bySource: { source: string; count: number }[];
  } | null;
  funnel: {
    viewItem: number; addToCart: number; beginCheckout: number; purchase: number;
    prevViewItem: number; prevAddToCart: number; prevBeginCheckout: number; prevPurchase: number;
    buyNowShare: number | null;   // share of add_to_cart from Buy Now, 0..1
    topLists: { list: string; clicks: number }[];
  } | null;
  abandoned: { created: number; recovered: number } | null;
  reviews: { newThisWeek: number; pendingApproval: number } | null;
  indexing: { state: string; pages: number }[] | null;
}

const DAY_MS = 86_400_000;

/** Start of today in Asia/Karachi, as a Date in UTC. */
function pktMidnightToday(): Date {
  const pkt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }); // YYYY-MM-DD
  // PKT is UTC+5 year-round (no DST).
  return new Date(`${pkt}T00:00:00+05:00`);
}

async function loadOrders(weekStart: Date, prevStart: Date): Promise<WeeklyReport['orders']> {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('orders')
      .select('total, status, pay_method, created_at, items, utm_source')
      .is('archived_at', null)
      .gte('created_at', prevStart.toISOString())
      .lt('created_at', new Date(weekStart.getTime() + 7 * DAY_MS).toISOString());
    if (error || !data) return null;
    type Row = { total: number | null; status: string | null; pay_method: string | null; created_at: string; items: { name?: string; qty?: number }[] | null; utm_source: string | null };
    const rows = data as Row[];
    const inWeek = (r: Row) => new Date(r.created_at) >= weekStart;
    // Same two-tier revenue convention as Finance/Analytics/v_orders_revenue
    // (2026-08-01 audit: this report used to count unpaid orders at full
    // value and returned/refunded at full total, so the Monday email
    // disagreed with every admin page for the same week):
    //   • cancelled / payment_failed / payment_pending → dropped entirely
    //     (cancelled keeps its own counter below),
    //   • refunded / returned → count as PLACED orders, contribute ZERO
    //     revenue.
    const DROPPED = new Set(['cancelled', 'payment_failed', 'payment_pending']);
    const ZERO_REVENUE = new Set(['refunded', 'returned']);
    const orderRevenue = (r: Row) => (ZERO_REVENUE.has(r.status ?? '') ? 0 : Number(r.total ?? 0));
    const live = rows.filter(r => !DROPPED.has(r.status ?? ''));
    const wk = live.filter(inWeek);
    const prev = live.filter(r => !inWeek(r));
    const revenue = wk.reduce((s, r) => s + orderRevenue(r), 0);
    const prevRevenue = prev.reduce((s, r) => s + orderRevenue(r), 0);
    const units = new Map<string, number>();
    for (const r of wk) for (const it of r.items ?? []) {
      if (!it?.name) continue;
      units.set(it.name, (units.get(it.name) ?? 0) + (it.qty ?? 1));
    }
    const bySrc = new Map<string, number>();
    for (const r of wk) {
      const s = (r.utm_source ?? '').trim() || 'direct / untagged';
      bySrc.set(s, (bySrc.get(s) ?? 0) + 1);
    }
    return {
      count: wk.length,
      prevCount: prev.length,
      revenue,
      prevRevenue,
      aov: wk.length ? Math.round(revenue / wk.length) : 0,
      codShare: wk.length ? wk.filter(r => r.pay_method === 'cod').length / wk.length : null,
      cancelled: rows.filter(r => r.status === 'cancelled' && inWeek(r)).length,
      topProducts: [...units.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([name, n]) => ({ name, units: n })),
      bySource: [...bySrc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([source, count]) => ({ source, count })),
    };
  } catch { return null; }
}

async function hogql(sql: string): Promise<unknown[][] | null> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`${PH_BASE}/api/projects/${PH_PROJECT_ID}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql } }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return ((await res.json()).results ?? []) as unknown[][];
  } catch { return null; }
}

async function loadFunnel(weekStart: Date, prevStart: Date): Promise<WeeklyReport['funnel']> {
  const ws = weekStart.toISOString();
  const ps = prevStart.toISOString();
  const we = new Date(weekStart.getTime() + 7 * DAY_MS).toISOString();
  const human = "coalesce(properties.`$virt_is_bot`, false) = false";
  const rows = await hogql(`
    SELECT event,
           countIf(timestamp >= toDateTime('${ws}') AND timestamp < toDateTime('${we}')) AS wk,
           countIf(timestamp >= toDateTime('${ps}') AND timestamp < toDateTime('${ws}')) AS prev
    FROM events
    WHERE event IN ('view_item','add_to_cart','begin_checkout','purchase')
      AND timestamp >= toDateTime('${ps}') AND timestamp < toDateTime('${we}')
      AND ${human}
    GROUP BY event`);
  if (!rows) return null;
  const get = (ev: string, i: 1 | 2) => Number(rows.find(r => r[0] === ev)?.[i] ?? 0);
  const [buyNowRows, listRows] = await Promise.all([
    hogql(`
      SELECT countIf(properties.source = 'buy_now') AS bn, count() AS total
      FROM events
      WHERE event = 'add_to_cart' AND ${human}
        AND timestamp >= toDateTime('${ws}') AND timestamp < toDateTime('${we}')`),
    hogql(`
      SELECT properties.list AS list, count() AS clicks
      FROM events
      WHERE event = 'select_item' AND ${human} AND coalesce(properties.list, '') != ''
        AND timestamp >= toDateTime('${ws}') AND timestamp < toDateTime('${we}')
      GROUP BY list ORDER BY clicks DESC LIMIT 8`),
  ]);
  const bnTotal = Number(buyNowRows?.[0]?.[1] ?? 0);
  return {
    viewItem: get('view_item', 1), addToCart: get('add_to_cart', 1),
    beginCheckout: get('begin_checkout', 1), purchase: get('purchase', 1),
    prevViewItem: get('view_item', 2), prevAddToCart: get('add_to_cart', 2),
    prevBeginCheckout: get('begin_checkout', 2), prevPurchase: get('purchase', 2),
    buyNowShare: bnTotal > 0 ? Number(buyNowRows?.[0]?.[0] ?? 0) / bnTotal : null,
    topLists: (listRows ?? []).map(r => ({ list: String(r[0]), clicks: Number(r[1]) || 0 })),
  };
}

async function loadAbandoned(weekStart: Date): Promise<WeeklyReport['abandoned']> {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('abandoned_carts')
      .select('recovered, created_at')
      .gte('created_at', weekStart.toISOString());
    if (error || !data) return null;
    const rows = data as { recovered: boolean | null }[];
    return { created: rows.length, recovered: rows.filter(r => r.recovered).length };
  } catch { return null; }
}

async function loadReviews(weekStart: Date): Promise<WeeklyReport['reviews']> {
  try {
    const sb = supabaseAdmin();
    const [wk, pending] = await Promise.all([
      sb.from('product_reviews').select('id', { count: 'exact', head: true })
        .gte('created_at', weekStart.toISOString()),
      sb.from('product_reviews').select('id', { count: 'exact', head: true })
        .eq('approved', false),
    ]);
    return { newThisWeek: wk.count ?? 0, pendingApproval: pending.count ?? 0 };
  } catch { return null; }
}

async function loadIndexing(): Promise<WeeklyReport['indexing']> {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('gsc_url_index_status')
      .select('coverage_state');
    if (error || !data) return null;
    const counts = new Map<string, number>();
    for (const r of data as { coverage_state: string | null }[]) {
      const st = r.coverage_state ?? 'Never checked';
      counts.set(st, (counts.get(st) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
      .map(([state, pages]) => ({ state, pages }));
  } catch { return null; }
}

export async function buildWeeklyReport(): Promise<WeeklyReport> {
  const todayPkt = pktMidnightToday();
  const weekStart = new Date(todayPkt.getTime() - 7 * DAY_MS);
  const prevStart = new Date(todayPkt.getTime() - 14 * DAY_MS);
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Karachi' });
  const [orders, funnel, abandoned, reviews, indexing] = await Promise.all([
    loadOrders(weekStart, prevStart),
    loadFunnel(weekStart, prevStart),
    loadAbandoned(weekStart),
    loadReviews(weekStart),
    loadIndexing(),
  ]);
  return {
    periodLabel: `${fmt(weekStart)} – ${fmt(new Date(todayPkt.getTime() - DAY_MS))}`,
    orders, funnel, abandoned, reviews, indexing,
  };
}
