// ── Microsoft Clarity Data Export API ───────────────────────────────────────
// The Clarity TAG has been on the storefront since 4 Sep (see
// components/analytics/MicrosoftClarity.tsx), but nothing read the data back:
// rage clicks, dead clicks and script errors only existed inside Clarity's own
// dashboard, so they were invisible next to the Google, Bing and PostHog cards
// on Admin → Analytics. This module is the READ side, mirroring lib/bing.ts.
//
// Auth is a JWT the owner generates in Clarity (Settings → Data Export →
// Generate new API token). It is a secret, so it lives in the
// CLARITY_API_TOKEN env var, never in site_settings — that table is readable
// with the anon key. Absent token = "not configured" and the dashboard shows
// the setup hint, exactly like Bing.
//
// Two hard limits from the API docs shape everything here:
//
//   • Only the last 1 to 3 days can be fetched, ever. There is no historical
//     range. Anything longer-term has to be SNAPSHOTTED daily on our side,
//     which is why the refresh job stores each day rather than re-querying.
//   • 10 requests per project per day, total. The daily refresh therefore
//     makes ONE call and derives every metric from that single response;
//     a per-metric fetch would burn the quota in a week of retries.
//
// Response shape: an array of { metricName, information: [...] } objects. The
// fields inside `information` vary per metric and the docs warn that more may
// appear, so parsing is defensive: unknown metrics are ignored rather than
// throwing, and every number is coerced (the API returns counts as STRINGS,
// e.g. "9554", while percentages come back as real numbers).

const API_URL = 'https://www.clarity.ms/export-data/api/v1/project-live-insights';

export function clarityApiToken(): string | null {
  const t = process.env.CLARITY_API_TOKEN?.trim();
  return t ? t : null;
}

export function isClarityConfigured(): boolean {
  return clarityApiToken() !== null;
}

export class ClarityApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ClarityApiError';
  }
}

/** Counts arrive as strings ("9554"), rates as numbers, and anything absent as
 *  undefined. One coercion so a metric never lands in the dashboard as NaN. */
export function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export interface ClarityRow { [key: string]: unknown }
export interface ClarityMetric { metricName: string; information: ClarityRow[] }

export interface ClaritySummary {
  /** Real (non-bot) sessions over the window. */
  sessions: number;
  /** Sessions Clarity classified as bots — worth seeing next to the real
   *  number, because this store blocks a long list of crawlers in robots.txt
   *  specifically to keep function invocations down. */
  botSessions: number;
  distinctUsers: number;
  pagesPerSession: number | null;
  /** Frustration signals. These are the reason to wire Clarity up at all:
   *  they point at the exact places a checkout loses people.
   *
   *  NULL means "Clarity returned this metric but its value could not be read
   *  confidently", which is different from zero. See metricTotal. */
  rageClicks: number | null;
  deadClicks: number | null;
  quickbackClicks: number | null;
  excessiveScroll: number | null;
  scriptErrors: number | null;
  errorClicks: number | null;
  /** Which metric names the API actually returned, so the dashboard can tell
   *  "zero rage clicks" apart from "Clarity did not report rage clicks". */
  metricsSeen: string[];
}

/** Sum one numeric field across every row of a named metric. */
function sumField(metrics: ClarityMetric[], metricName: string, field: string): number {
  const m = metrics.find(x => x.metricName === metricName);
  if (!m || !Array.isArray(m.information)) return 0;
  return m.information.reduce((t, row) => t + num(row[field]), 0);
}

/** Field names that are a DENOMINATOR, not a metric value. Every metric's
 *  rows carry the project's session total alongside the metric's own figure,
 *  and picking the first numeric field meant every frustration signal read
 *  back as the session count. Observed live on 14 Sep 2026: sessions 51,
 *  rage clicks 51, dead clicks 51, script errors 51 — all the same number,
 *  all wrong. These are excluded from the search. */
const DENOMINATOR_FIELDS = /^(total)?(session|bot|distinct|distant|user|page)s?(count|views)?$/i;

/** Words that identify a field as belonging to a specific metric rather than
 *  being a shared total. Keyed by metric so "rage" only matches rage clicks. */
const METRIC_WORDS: Record<string, RegExp> = {
  RageClickCount:    /rage/i,
  DeadClickCount:    /dead/i,
  QuickbackClick:    /quickback|quick_back/i,
  ExcessiveScroll:   /excessive|scroll/i,
  ScriptErrorCount:  /script/i,
  ErrorClickCount:   /errorclick|error_click/i,
};

/** Total a frustration metric, or return NULL when it cannot be read
 *  confidently.
 *
 *  Microsoft documents the response shape for `Traffic` only, and says
 *  outright that "additional metrics and dimensions may be included in the
 *  full API response" without listing their fields. So the field name for
 *  each frustration metric is genuinely unknown, and the first version of
 *  this function guessed — which is how the card shipped showing the session
 *  count six times over.
 *
 *  The rule now: take a field whose name carries this metric's own concept
 *  (a "rageClickCount" for RageClickCount), never a shared denominator. If
 *  nothing matches, return null so the card prints "not reported" instead of
 *  a confident wrong number. The raw response is stored alongside the summary
 *  so the real field names can be read off a live payload and pinned here. */
function metricTotal(metrics: ClarityMetric[], metricName: string): number | null {
  const m = metrics.find(x => x.metricName === metricName);
  if (!m || !Array.isArray(m.information) || m.information.length === 0) return null;

  const concept = METRIC_WORDS[metricName];
  let found = false;
  let total = 0;

  for (const row of m.information) {
    const key = Object.keys(row).find(k => {
      if (DENOMINATOR_FIELDS.test(k)) return false;
      if (concept && !concept.test(k)) return false;
      return typeof row[k] === 'number' || typeof row[k] === 'string';
    });
    if (key !== undefined) { found = true; total += num(row[key]); }
  }

  return found ? total : null;
}

/** Fold the raw API response into the handful of figures the admin card shows. */
export function summarise(metrics: ClarityMetric[]): ClaritySummary {
  const traffic = metrics.find(m => m.metricName === 'Traffic');
  const pps = traffic?.information?.length
    ? traffic.information.reduce((t, r) => t + num(r.PagesPerSessionPercentage), 0) / traffic.information.length
    : null;

  return {
    sessions: sumField(metrics, 'Traffic', 'totalSessionCount'),
    botSessions: sumField(metrics, 'Traffic', 'totalBotSessionCount'),
    distinctUsers: sumField(metrics, 'Traffic', 'distantUserCount'),
    pagesPerSession: pps === null ? null : Math.round(pps * 100) / 100,
    rageClicks: metricTotal(metrics, 'RageClickCount'),
    deadClicks: metricTotal(metrics, 'DeadClickCount'),
    quickbackClicks: metricTotal(metrics, 'QuickbackClick'),
    excessiveScroll: metricTotal(metrics, 'ExcessiveScroll'),
    scriptErrors: metricTotal(metrics, 'ScriptErrorCount'),
    errorClicks: metricTotal(metrics, 'ErrorClickCount'),
    metricsSeen: metrics.map(m => m.metricName).filter(Boolean),
  };
}

/** One call, because the quota is 10 per project per DAY.
 *
 *  `numOfDays` is capped at 3 by the API; anything larger is a 400, so it is
 *  clamped here rather than relayed. No dimension is requested: a dimension
 *  splits every metric into rows per browser/OS/country, which costs the same
 *  quota but returns data the admin card does not show. */
export async function fetchClarityInsights(numOfDays = 1): Promise<ClarityMetric[]> {
  const token = clarityApiToken();
  if (!token) throw new ClarityApiError('Clarity API token is not configured.', 0);

  const days = Math.min(3, Math.max(1, Math.round(numOfDays)));
  const res = await fetch(`${API_URL}?numOfDays=${days}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    // 429 is the one worth naming: the quota is small enough that a retry loop
    // would burn a whole day's allowance, so the caller must not retry.
    const detail = res.status === 429
      ? 'Clarity daily API quota exhausted (10 requests per project per day).'
      : `Clarity API ${res.status}`;
    throw new ClarityApiError(detail, res.status);
  }

  const body: unknown = await res.json();
  if (!Array.isArray(body)) return [];
  return body.filter(
    (m): m is ClarityMetric =>
      !!m && typeof m === 'object' && typeof (m as ClarityMetric).metricName === 'string',
  );
}

/** What the refresh job stores under the `clarity` key in analytics_cache.
 *
 *  `raw` is kept deliberately. Microsoft documents the field names for the
 *  Traffic metric ONLY, so the frustration metrics are parsed by inference;
 *  storing the payload means the next refresh reveals the true field names
 *  without spending another call from the 10-per-day quota. It is small (a
 *  dozen-odd metrics with a handful of rows each) and it is not shopper data. */
export async function getClaritySnapshot(numOfDays = 1): Promise<ClaritySummary & { days: number; raw: ClarityMetric[] }> {
  const metrics = await fetchClarityInsights(numOfDays);
  return {
    ...summarise(metrics),
    days: Math.min(3, Math.max(1, Math.round(numOfDays))),
    raw: metrics,
  };
}
