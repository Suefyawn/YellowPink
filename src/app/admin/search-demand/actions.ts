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
export interface SearchDemand {
  gscUpdatedAt: string | null;
  winnable: GscRow[];       // rank 8–40: one push from page 1
  lowCtr: GscRow[];         // page 1 but poor CTR: a title/meta fix
  onsite: OnsiteRow[];      // on-site searches, results flagged
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
    } catch {
      onsite = [];
    }
  }

  return { gscUpdatedAt: gscCache?.updated_at ?? null, winnable, lowCtr, onsite, posthog, days };
}
