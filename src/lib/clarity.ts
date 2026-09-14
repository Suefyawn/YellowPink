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
   *  they point at the exact places a checkout loses people. */
  rageClicks: number;
  deadClicks: number;
  quickbackClicks: number;
  excessiveScroll: number;
  scriptErrors: number;
  errorClicks: number;
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

/** Total the `sessionsCount`-style field a frustration metric reports. The
 *  docs do not pin the field name per metric and warn that the response may
 *  carry extra fields, so take the first numeric-looking one that is not a
 *  dimension label rather than hard-coding a name that may drift. */
function sumCount(metrics: ClarityMetric[], metricName: string): number {
  const m = metrics.find(x => x.metricName === metricName);
  if (!m || !Array.isArray(m.information)) return 0;
  return m.information.reduce((total, row) => {
    const key = Object.keys(row).find(k => /count|sessions|clicks/i.test(k) && num(row[k]) > 0);
    return total + (key ? num(row[key]) : 0);
  }, 0);
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
    rageClicks: sumCount(metrics, 'RageClickCount'),
    deadClicks: sumCount(metrics, 'DeadClickCount'),
    quickbackClicks: sumCount(metrics, 'QuickbackClick'),
    excessiveScroll: sumCount(metrics, 'ExcessiveScroll'),
    scriptErrors: sumCount(metrics, 'ScriptErrorCount'),
    errorClicks: sumCount(metrics, 'ErrorClickCount'),
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

/** What the refresh job stores under the `clarity` key in analytics_cache. */
export async function getClaritySnapshot(numOfDays = 1): Promise<ClaritySummary & { days: number }> {
  const metrics = await fetchClarityInsights(numOfDays);
  return { ...summarise(metrics), days: Math.min(3, Math.max(1, Math.round(numOfDays))) };
}
