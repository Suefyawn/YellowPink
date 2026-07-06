// ============================================================================
// Search-demand report data. Two questions this answers:
//   1. Google: which queries do we already rank for but sit off page 1? Those
//      are winnable with a content/link nudge. (Source: the daily-cached GSC
//      search-analytics snapshot in analytics_cache.)
//   2. On-site: what are shoppers typing into our own search box, and which of
//      those return no / thin product results? Those are the stock-or-create
//      gaps — the highest-signal shopping list we have. (Source: PostHog
//      `search` events, cross-checked against the live search_products RPC.)
// ============================================================================

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';

const PH_PROJECT_ID = 429225;
const PH_BASE = 'https://us.posthog.com';

export interface GscRow { query: string; impressions: number; clicks: number; position: number; ctr: number }
export interface OnsiteRow { query: string; searches: number; people: number; results: number; spark: number[] }
// A term that DOES return products but whose searchers rarely go on to buy —
// demand you're showing product for but losing at the shelf.
export interface ConvRow { query: string; searchers: number; buyers: number; results: number }
// Search interest rolled up to a catalogue brand / category.
export interface RollupRow { name: string; searches: number; terms: number }
export interface SearchDemand {
  gscUpdatedAt: string | null;
  winnable: GscRow[];       // rank 8–40: one push from page 1
  lowCtr: GscRow[];         // page 1 but poor CTR: a title/meta fix
  onsite: OnsiteRow[];      // on-site searches, results flagged
  nonConverting: ConvRow[]; // searched a lot, results shown, searchers rarely buy
  brandDemand: RollupRow[]; // on-site search interest per stocked brand
  categoryDemand: RollupRow[];
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

export async function getSearchDemand(rangeDays?: number): Promise<SearchDemand> {
  const sb = supabaseAdmin();
  const days = normalizeDays(rangeDays);

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

  // ── 2. On-site searches from PostHog, cross-checked against the catalogue ──
  let onsite: OnsiteRow[] = [];
  let nonConverting: ConvRow[] = [];
  let brandDemand: RollupRow[] = [];
  let categoryDemand: RollupRow[] = [];
  let posthog: 'ok' | 'no-key' = 'no-key';
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  if (apiKey) {
    posthog = 'ok';
    try {
      const [rows, weekRows] = await Promise.all([
        phQuery(apiKey, `
          SELECT properties.query AS q, count() AS n, count(distinct distinct_id) AS people
          FROM events
          WHERE event = 'search'
            AND timestamp >= now() - interval ${days} day
            AND properties.query != ''
          GROUP BY q
          ORDER BY n DESC
          LIMIT 60`),
        // Per-term weekly counts drive the trend sparkline (growing vs fading).
        phQuery(apiKey, `
          SELECT properties.query AS q, toStartOfWeek(timestamp) AS wk, count() AS n
          FROM events
          WHERE event = 'search'
            AND timestamp >= now() - interval ${days} day
            AND properties.query != ''
          GROUP BY q, wk
          ORDER BY wk`),
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

      const raw = rows
        .map(r => {
          const query = String(r[0] ?? '').trim();
          return {
            query,
            searches: Number(r[1]) || 0,
            people: Number(r[2]) || 0,
            spark: seriesFor.get(query) ?? new Array(weekAxis.length).fill(0),
          };
        })
        .filter(t => t.query && !isJunkQuery(t.query));

      // Collapse keystroke prefixes: historically the event fired per keystroke,
      // so "co","coll","collagen" all logged. Fold each term that is a
      // case-insensitive prefix of a longer one into that longer (settled)
      // term, keeping the chain's peak counts (per-week peak for the spark).
      // (Going forward the settle-delay fix in SearchOverlay stops the chains
      // at the source.)
      const byLen = [...raw].sort((a, b) => b.query.length - a.query.length);
      const terms: typeof raw = [];
      for (const t of byLen) {
        const parent = terms.find(k => k.query.toLowerCase().startsWith(t.query.toLowerCase()));
        if (parent) {
          parent.searches = Math.max(parent.searches, t.searches);
          parent.people = Math.max(parent.people, t.people);
          parent.spark = parent.spark.map((v, i) => Math.max(v, t.spark[i] ?? 0));
        } else {
          terms.push({ ...t });
        }
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
          .filter(t => t.query && !isJunkQuery(t.query));
        // Same prefix-collapse as the on-site list, peak-merged.
        const convByLen = [...convRaw].sort((a, b) => b.query.length - a.query.length);
        const convTerms: typeof convRaw = [];
        for (const t of convByLen) {
          const parent = convTerms.find(k => k.query.toLowerCase().startsWith(t.query.toLowerCase()));
          if (parent) { parent.searchers = Math.max(parent.searchers, t.searchers); parent.buyers = Math.max(parent.buyers, t.buyers); }
          else convTerms.push({ ...t });
        }
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

  return { gscUpdatedAt: gscCache?.updated_at ?? null, winnable, lowCtr, onsite, nonConverting, brandDemand, categoryDemand, posthog, days };
}
