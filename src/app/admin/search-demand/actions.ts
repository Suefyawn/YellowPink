// ============================================================================
// Search-demand report data. The questions this answers:
//   1. Google: which queries do we already rank for but sit off page 1? Those
//      are winnable with a content/link nudge. (Source: the daily-cached GSC
//      search-analytics snapshot in analytics_cache, plus gsc_query_snapshots
//      history for rising/falling movers.)
//   2. On-site: what are shoppers typing into our own search box, and which of
//      those return no / thin product results? Those are the stock-or-create
//      gaps — the highest-signal shopping list we have. (Source: PostHog
//      `search` events, cross-checked against the live search_products RPC.)
//   3. Momentum: is each demand growing or fading? (Current window vs the
//      window before it, plus a daily series for the trend chart.)
// ============================================================================

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';

const PH_PROJECT_ID = 429225;
const PH_BASE = 'https://us.posthog.com';

export interface GscRow { query: string; impressions: number; clicks: number; position: number; ctr: number }
export interface OnsiteRow {
  query: string;
  searches: number;
  people: number;
  results: number;
  spark: number[];
  /** Searches in the equal-length window immediately before this one. */
  prev: number;
}
// A term that DOES return products but whose searchers rarely go on to buy —
// demand you're showing product for but losing at the shelf.
export interface ConvRow { query: string; searchers: number; buyers: number; results: number }
// Search interest rolled up to a catalogue brand / category.
export interface RollupRow { name: string; searches: number; terms: number }
// One day of on-site search activity for the trend chart.
export interface DemandDay { date: string; searches: number; people: number; zero: number }
// A Google query whose 28-day aggregate moved between two snapshot days.
export interface MoverRow { query: string; impressions: number; position: number; prevPosition: number; prevImpressions: number }

export interface DemandKpis {
  searches: number;      prevSearches: number;
  people: number;        prevPeople: number;
  uniqueTerms: number;
  /** Share (0..1) of on-site search volume that found zero products. */
  zeroShare: number;
  /** Share (0..1) of searchers who purchased within the window (cohort proxy). */
  buyThrough: number | null;
  prevBuyThrough: number | null;
}

export interface SearchDemand {
  gscUpdatedAt: string | null;
  winnable: GscRow[];       // rank 8–40: one push from page 1
  lowCtr: GscRow[];         // page 1 but poor CTR: a title/meta fix
  onsite: OnsiteRow[];      // on-site searches, results flagged, momentum attached
  nonConverting: ConvRow[]; // searched a lot, results shown, searchers rarely buy
  brandDemand: RollupRow[]; // on-site search interest per stocked brand
  categoryDemand: RollupRow[];
  daily: DemandDay[];       // per-day series for the trend chart
  /** True once the storefront logs a results count on search events, which
   *  makes the per-day zero-result line in `daily` meaningful. */
  hasResultCounts: boolean;
  kpis: DemandKpis;
  moversUp: MoverRow[];     // Google queries gaining position/impressions
  moversDown: MoverRow[];
  /** Distinct snapshot days accumulated so far (movers need ≥ 2, ~7 apart). */
  moverHistoryDays: number;
  ignored: string[];        // terms staff chose to hide (shown in a manager)
  posthog: 'ok' | 'no-key';
  days: number;             // on-site window actually used
}

// On-site window options offered by the report's range toggle.
export const RANGE_OPTIONS = [7, 30, 60, 90] as const;
function normalizeDays(d: number | undefined): number {
  return (RANGE_OPTIONS as readonly number[]).includes(d ?? 0) ? (d as number) : 60;
}

// Junk / operator-laden crawler queries we never want to surface as "demand".
function isJunkQuery(q: string): boolean {
  return !q || q.length > 80 || /site:|https?:|-site:|\b\d{10,}\b/i.test(q);
}

async function phQuery(apiKey: string, sql: string): Promise<unknown[][]> {
  const res = await fetch(`${PH_BASE}/api/projects/${PH_PROJECT_ID}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql } }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`PostHog ${res.status}`);
  return ((await res.json()).results ?? []) as unknown[][];
}

/** Collapse keystroke prefixes ("co","coll","collagen" → "collagen"), keeping
 *  the chain's peak counts. Shared by every per-term list so they agree. */
function collapsePrefixes<T extends { query: string }>(
  rows: T[],
  merge: (parent: T, child: T) => void,
): T[] {
  const byLen = [...rows].sort((a, b) => b.query.length - a.query.length);
  const out: T[] = [];
  for (const t of byLen) {
    const parent = out.find(k => k.query.toLowerCase().startsWith(t.query.toLowerCase()));
    if (parent) merge(parent, t);
    else out.push({ ...t });
  }
  return out;
}

export async function getSearchDemand(rangeDays?: number): Promise<SearchDemand> {
  const sb = supabaseAdmin();
  const days = normalizeDays(rangeDays);

  // Terms staff hid from the report. Applied to every on-site list.
  let ignored: string[] = [];
  try {
    const { data } = await sb.from('search_demand_ignores').select('term');
    ignored = ((data ?? []) as { term: string }[]).map(r => r.term);
  } catch { /* table may not exist yet locally */ }
  const ignoredSet = new Set(ignored.map(t => t.toLowerCase()));

  // ── 1. GSC queries from the daily cache ──
  const { data: gscCache } = await sb
    .from('analytics_cache').select('data, updated_at').eq('key', 'gsc').maybeSingle();
  const gsc = (gscCache?.data ?? {}) as { queries?: GscRow[] };
  const queries = (gsc.queries ?? []).filter(q => q.query && !isJunkQuery(q.query));

  const winnable = queries
    .filter(q => q.position > 7 && q.position <= 40 && q.impressions >= 2)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 25);
  const lowCtr = queries
    .filter(q => q.position <= 7 && q.impressions >= 10 && q.ctr < 0.05)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15);

  // ── 1b. Google movers from the accumulated per-day snapshots ──
  // Each snapshot row is a trailing-28d aggregate keyed by its capture day, so
  // comparing two capture days ~a week apart is a smoothed momentum signal.
  let moversUp: MoverRow[] = [];
  let moversDown: MoverRow[] = [];
  let moverHistoryDays = 0;
  try {
    const { data: dayRows } = await sb
      .from('gsc_query_snapshots')
      .select('day')
      .order('day', { ascending: false })
      .limit(400);
    const daysSeen = [...new Set(((dayRows ?? []) as { day: string }[]).map(r => r.day))];
    moverHistoryDays = daysSeen.length;
    if (daysSeen.length >= 2) {
      const latest = daysSeen[0];
      // The snapshot closest to 7 days before the latest (else the oldest).
      const target = new Date(new Date(`${latest}T00:00:00Z`).getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
      const baseline = daysSeen.slice(1).reduce((best, d) =>
        Math.abs(new Date(d).getTime() - new Date(target).getTime()) <
        Math.abs(new Date(best).getTime() - new Date(target).getTime()) ? d : best,
      daysSeen[1]);
      const [{ data: curRows }, { data: prevRows }] = await Promise.all([
        sb.from('gsc_query_snapshots').select('query, impressions, position').eq('day', latest),
        sb.from('gsc_query_snapshots').select('query, impressions, position').eq('day', baseline),
      ]);
      type Snap = { query: string; impressions: number; position: number | null };
      const prevBy = new Map(((prevRows ?? []) as Snap[]).map(r => [r.query, r]));
      const movers: MoverRow[] = [];
      for (const cur of (curRows ?? []) as Snap[]) {
        const prev = prevBy.get(cur.query);
        if (!prev || cur.position == null || prev.position == null) continue;
        if (isJunkQuery(cur.query)) continue;
        movers.push({
          query: cur.query,
          impressions: cur.impressions,
          position: cur.position,
          prevPosition: prev.position,
          prevImpressions: prev.impressions,
        });
      }
      // Position deltas under half a spot are noise, not movement.
      moversUp = movers
        .filter(m => m.prevPosition - m.position >= 0.5)
        .sort((a, b) => (b.prevPosition - b.position) - (a.prevPosition - a.position))
        .slice(0, 8);
      moversDown = movers
        .filter(m => m.position - m.prevPosition >= 0.5)
        .sort((a, b) => (b.position - b.prevPosition) - (a.position - a.prevPosition))
        .slice(0, 8);
    }
  } catch { /* history table empty/missing — movers stay empty */ }

  // ── 2. On-site searches from PostHog, cross-checked against the catalogue ──
  let onsite: OnsiteRow[] = [];
  let nonConverting: ConvRow[] = [];
  let brandDemand: RollupRow[] = [];
  let categoryDemand: RollupRow[] = [];
  let daily: DemandDay[] = [];
  let hasResultCounts = false;
  const kpis: DemandKpis = {
    searches: 0, prevSearches: 0, people: 0, prevPeople: 0,
    uniqueTerms: 0, zeroShare: 0, buyThrough: null, prevBuyThrough: null,
  };
  let posthog: 'ok' | 'no-key' = 'no-key';
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  if (apiKey) {
    posthog = 'ok';
    try {
      const [rows, weekRows, prevRows, dayRows, buyRows] = await Promise.all([
        phQuery(apiKey, `
          SELECT properties.query AS q, count() AS n, count(distinct distinct_id) AS people
          FROM events
          WHERE event = 'search'
            AND timestamp >= now() - interval ${days} day
            AND properties.query != ''
          GROUP BY q
          ORDER BY n DESC
          LIMIT 80`),
        // Per-term weekly counts drive the trend sparkline (growing vs fading).
        phQuery(apiKey, `
          SELECT properties.query AS q, toStartOfWeek(timestamp) AS wk, count() AS n
          FROM events
          WHERE event = 'search'
            AND timestamp >= now() - interval ${days} day
            AND properties.query != ''
          GROUP BY q, wk
          ORDER BY wk`),
        // The window before this one, for per-term momentum.
        phQuery(apiKey, `
          SELECT properties.query AS q, count() AS n
          FROM events
          WHERE event = 'search'
            AND timestamp >= now() - interval ${days * 2} day
            AND timestamp <  now() - interval ${days} day
            AND properties.query != ''
          GROUP BY q`),
        // Daily series for the trend chart. `results` only exists on events
        // logged after the storefront started attaching it; countIf on the
        // parsed value stays 0 for older data and the chart hides that line.
        phQuery(apiKey, `
          SELECT toDate(timestamp) AS d,
                 count() AS n,
                 count(distinct distinct_id) AS people,
                 countIf(toInt64OrNull(toString(properties.results)) = 0) AS zero,
                 countIf(toInt64OrNull(toString(properties.results)) IS NOT NULL) AS with_results
          FROM events
          WHERE event = 'search'
            AND timestamp >= now() - interval ${days} day
            AND properties.query != ''
          GROUP BY d
          ORDER BY d`),
        // Overall searcher → buyer cohort, current and previous window.
        phQuery(apiKey, `
          WITH s1 AS (
            SELECT DISTINCT distinct_id FROM events
            WHERE event = 'search' AND timestamp >= now() - interval ${days} day AND properties.query != ''
          ), b1 AS (
            SELECT DISTINCT distinct_id FROM events
            WHERE event = 'purchase' AND timestamp >= now() - interval ${days} day
          ), s0 AS (
            SELECT DISTINCT distinct_id FROM events
            WHERE event = 'search'
              AND timestamp >= now() - interval ${days * 2} day AND timestamp < now() - interval ${days} day
              AND properties.query != ''
          ), b0 AS (
            SELECT DISTINCT distinct_id FROM events
            WHERE event = 'purchase'
              AND timestamp >= now() - interval ${days * 2} day AND timestamp < now() - interval ${days} day
          )
          SELECT
            (SELECT count() FROM s1) AS searchers,
            (SELECT count() FROM s1 WHERE distinct_id IN (SELECT distinct_id FROM b1)) AS buyers,
            (SELECT count() FROM s0) AS prev_searchers,
            (SELECT count() FROM s0 WHERE distinct_id IN (SELECT distinct_id FROM b0)) AS prev_buyers`),
      ]);

      // Fixed week axis so every sparkline lines up. Built from the labels the
      // data returned, sorted oldest → newest.
      const weekAxis = [...new Set(weekRows.map(r => String(r[1] ?? '')))].filter(Boolean).sort();
      const weekIdx = new Map(weekAxis.map((w, i) => [w, i]));
      // query → weekly count vector aligned to weekAxis.
      const seriesFor = new Map<string, number[]>();
      for (const r of weekRows) {
        const q = String(r[0] ?? '').trim();
        const i = weekIdx.get(String(r[1] ?? ''));
        if (!q || i === undefined) continue;
        let vec = seriesFor.get(q);
        if (!vec) { vec = new Array(weekAxis.length).fill(0); seriesFor.set(q, vec); }
        vec[i] = Number(r[2]) || 0;
      }

      // Previous-window counts, prefix-collapsed the same way as the main
      // list so the momentum comparison is like-for-like.
      const prevRaw = prevRows
        .map(r => ({ query: String(r[0] ?? '').trim(), searches: Number(r[1]) || 0 }))
        .filter(t => t.query && !isJunkQuery(t.query));
      const prevTerms = collapsePrefixes(prevRaw, (p, c) => { p.searches = Math.max(p.searches, c.searches); });
      const prevBy = new Map(prevTerms.map(t => [t.query.toLowerCase(), t.searches]));

      const raw = rows
        .map(r => {
          const query = String(r[0] ?? '').trim();
          return {
            query,
            searches: Number(r[1]) || 0,
            people: Number(r[2]) || 0,
            spark: seriesFor.get(query) ?? new Array(weekAxis.length).fill(0),
            prev: 0,
          };
        })
        .filter(t => t.query && !isJunkQuery(t.query) && !ignoredSet.has(t.query.toLowerCase()));

      const terms = collapsePrefixes(raw, (p, c) => {
        p.searches = Math.max(p.searches, c.searches);
        p.people = Math.max(p.people, c.people);
        p.spark = p.spark.map((v, i) => Math.max(v, c.spark[i] ?? 0));
      });
      for (const t of terms) {
        // A prev-window term that is a prefix of this one (or vice versa)
        // counts as the same demand.
        t.prev = prevBy.get(t.query.toLowerCase())
          ?? [...prevBy.entries()].find(([q]) => q.startsWith(t.query.toLowerCase()) || t.query.toLowerCase().startsWith(q))?.[1]
          ?? 0;
      }
      terms.sort((a, b) => b.searches - a.searches);

      // How many products each term actually returns (same RPC the storefront
      // search uses), so we can flag the zero / thin results.
      const counts = await Promise.all(terms.map(async t => {
        try {
          const { data } = await sb.rpc('search_products' as never, { p_query: t.query, p_limit: 5 } as never);
          return Array.isArray(data) ? data.length : 0;
        } catch { return -1; } // -1 = couldn't check
      }));
      onsite = terms.map((t, i) => ({ ...t, results: counts[i] }));
      const resultsByQuery = new Map(onsite.map(o => [o.query.toLowerCase(), o.results]));

      // ── KPIs ──
      daily = dayRows.map(r => ({
        date: String(r[0] ?? ''),
        searches: Number(r[1]) || 0,
        people: Number(r[2]) || 0,
        zero: Number(r[3]) || 0,
      })).filter(d => d.date);
      hasResultCounts = dayRows.some(r => (Number(r[4]) || 0) > 0);
      kpis.searches = daily.reduce((s, d) => s + d.searches, 0);
      kpis.uniqueTerms = onsite.length;
      const totalVol = onsite.reduce((s, o) => s + o.searches, 0);
      const zeroVol = onsite.filter(o => o.results === 0).reduce((s, o) => s + o.searches, 0);
      kpis.zeroShare = totalVol > 0 ? zeroVol / totalVol : 0;
      kpis.prevSearches = prevTerms.reduce((s, t) => s + t.searches, 0);
      const bt = buyRows[0] ?? [];
      const searchers = Number(bt[0]) || 0;
      const buyers = Number(bt[1]) || 0;
      const prevSearchers = Number(bt[2]) || 0;
      const prevBuyers = Number(bt[3]) || 0;
      kpis.people = searchers;
      kpis.prevPeople = prevSearchers;
      kpis.buyThrough = searchers > 0 ? buyers / searchers : null;
      kpis.prevBuyThrough = prevSearchers > 0 ? prevBuyers / prevSearchers : null;

      // ── C1. Searches that show products but whose searchers rarely buy ──
      // A cohort proxy: of the distinct people who searched a term, how many
      // went on to purchase anything in the window. A high-volume term with a
      // low buy-through is friction on a demand we're already meeting.
      try {
        const convRows = await phQuery(apiKey, `
          WITH buyers AS (
            SELECT DISTINCT distinct_id FROM events
            WHERE event = 'purchase' AND timestamp >= now() - interval ${days} day
          )
          SELECT properties.query AS q,
                 count(DISTINCT distinct_id) AS searchers,
                 count(DISTINCT if(distinct_id IN (SELECT distinct_id FROM buyers), distinct_id, NULL)) AS buyers
          FROM events
          WHERE event = 'search'
            AND timestamp >= now() - interval ${days} day
            AND properties.query != ''
          GROUP BY q
          HAVING searchers >= 3
          ORDER BY searchers DESC
          LIMIT 60`);
        const convRaw = convRows
          .map(r => ({ query: String(r[0] ?? '').trim(), searchers: Number(r[1]) || 0, buyers: Number(r[2]) || 0 }))
          .filter(t => t.query && !isJunkQuery(t.query) && !ignoredSet.has(t.query.toLowerCase()));
        const convTerms = collapsePrefixes(convRaw, (p, c) => {
          p.searchers = Math.max(p.searchers, c.searchers);
          p.buyers = Math.max(p.buyers, c.buyers);
        });
        nonConverting = convTerms
          // Only terms we actually return products for (>0), so this is "shown
          // but not converting", not the same as the zero-result gaps above.
          .map(t => ({ ...t, results: resultsByQuery.get(t.query.toLowerCase()) ?? -1 }))
          .filter(t => t.results > 0)
          .sort((a, b) => (a.buyers / a.searchers) - (b.buyers / b.searchers) || b.searchers - a.searchers)
          .slice(0, 12);
      } catch { nonConverting = []; }

      // ── C2. Roll on-site search interest up to stocked brands / categories ──
      // Each searched term is matched (case-insensitive substring) against the
      // catalogue's brand and category names, so the owner sees which ranges
      // shoppers are hunting for by name — a merchandising / feature signal.
      try {
        const { data: catRows } = await sb
          .from('products').select('brand, category').eq('status', 'published');
        const rollup = (names: string[]): RollupRow[] => {
          const seen = [...new Set(names.map(n => (n ?? '').trim()).filter(Boolean))];
          return seen.map(name => {
            const nl = name.toLowerCase();
            const hits = onsite.filter(o => o.query.toLowerCase().includes(nl));
            return { name, searches: hits.reduce((s, o) => s + o.searches, 0), terms: hits.length };
          }).filter(r => r.searches > 0).sort((a, b) => b.searches - a.searches).slice(0, 15);
        };
        const rows2 = (catRows ?? []) as { brand: string | null; category: string | null }[];
        brandDemand = rollup(rows2.map(r => r.brand ?? ''));
        categoryDemand = rollup(rows2.map(r => r.category ?? ''));
      } catch { brandDemand = []; categoryDemand = []; }
    } catch {
      onsite = [];
    }
  }

  return {
    gscUpdatedAt: gscCache?.updated_at ?? null,
    winnable, lowCtr, onsite, nonConverting, brandDemand, categoryDemand,
    daily, hasResultCounts, kpis, moversUp, moversDown, moverHistoryDays,
    ignored, posthog, days,
  };
}
