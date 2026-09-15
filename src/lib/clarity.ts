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

/** One frustration signal. Clarity gives both the raw count and the share of
 *  sessions that hit it; the share is the comparable number day to day, since
 *  a raw count rises simply because traffic rose. */
export interface ClaritySignal {
  /** Occurrences over the window. Null when Clarity did not report it. */
  count: number | null;
  /** Percent of sessions with at least one, 0-100. Null when not reported. */
  sessionPercent: number | null;
}

export interface ClarityDimensionRow {
  name: string;
  sessions: number;
}

export interface ClaritySummary {
  /** Real (non-bot) sessions over the window. */
  sessions: number;
  /** Sessions Clarity classified as bots — worth seeing next to the real
   *  number, because this store blocks a long list of crawlers in robots.txt
   *  specifically to keep function invocations down. */
  botSessions: number;
  distinctUsers: number;
  pagesPerSession: number | null;
  /** Average share of a page scrolled, 0-100. */
  averageScrollDepth: number | null;
  /** Clarity reports engagement in minutes, total and active. Active time is
   *  the one worth reading: total time counts a tab left open. */
  totalTimeMinutes: number | null;
  activeTimeMinutes: number | null;
  /** Frustration signals. These are the reason to wire Clarity up at all:
   *  they point at the exact places a checkout loses people. */
  rageClicks: ClaritySignal;
  deadClicks: ClaritySignal;
  quickbackClicks: ClaritySignal;
  excessiveScroll: ClaritySignal;
  scriptErrors: ClaritySignal;
  errorClicks: ClaritySignal;
  /** Session split by device. Mobile share decides a lot of layout arguments,
   *  and it arrives free on the same call. */
  devices: ClarityDimensionRow[];
  /** Which metric names the API actually returned, so the dashboard can tell
   *  "zero rage clicks" apart from "Clarity did not report rage clicks". */
  metricsSeen: string[];
}

/** Field names, pinned to a real response.
 *
 *  Microsoft documents the shape of `Traffic` and nothing else, and the first
 *  two versions of this file GUESSED at the rest. The first guess picked the
 *  first numeric field in each row, which is the session total, so the card
 *  shipped reporting 51 rage clicks, 51 dead clicks and 51 script errors on a
 *  day with 51 sessions. The second guess refused to read anything it could
 *  not name, which was honest but printed a dash for every signal.
 *
 *  The token is live now, so this is no longer guesswork. Observed response,
 *  15 Sep 2026 (stored in full under `raw` on every snapshot):
 *
 *    { "metricName": "DeadClickCount", "information": [{
 *        "subTotal": 5, "pagesViews": 4, "sessionsCount": 54,
 *        "sessionsWithMetricPercentage": 7.41,
 *        "sessionsWithoutMetricPercentage": 92.59 }] }
 *
 *  So every frustration metric carries its count in `subTotal` and the share
 *  of sessions affected in `sessionsWithMetricPercentage`, and `sessionsCount`
 *  is the denominator that fooled the first version.
 *
 *  The names stay in one table so a future rename is a one-line edit, and
 *  anything not found still yields null rather than a confident wrong number. */
export type FrustrationMetric =
  | 'RageClickCount'
  | 'DeadClickCount'
  | 'QuickbackClick'
  | 'ExcessiveScroll'
  | 'ScriptErrorCount'
  | 'ErrorClickCount';

/** The count field on a frustration metric. */
const COUNT_FIELD = 'subTotal';
/** The share-of-sessions field on a frustration metric. */
const SHARE_FIELD = 'sessionsWithMetricPercentage';

/** Read one field off every row of a metric, returning null when the metric is
 *  absent or the field is not present on any row.
 *
 *  Null and zero are different answers and the card renders them differently:
 *  zero means Clarity counted none, null means we could not read it. Returning
 *  0 for an unreadable field is the specific mistake this module has already
 *  made once. */
function readField(
  metrics: ClarityMetric[],
  metricName: string,
  field: string,
  combine: 'sum' | 'mean' = 'sum',
): number | null {
  const m = metrics.find(x => x.metricName === metricName);
  if (!m || !Array.isArray(m.information) || m.information.length === 0) return null;

  const rows = m.information.filter(r => r && r[field] !== undefined && r[field] !== null);
  if (rows.length === 0) return null;

  const total = rows.reduce((t, r) => t + num(r[field]), 0);
  return combine === 'mean' ? total / rows.length : total;
}

/** One named dimension (Device, Country, Browser…) as name → sessions, largest
 *  first. Clarity returns these on the same single call, so they cost nothing
 *  extra against the 10-per-day quota. */
function dimension(metrics: ClarityMetric[], metricName: string): ClarityDimensionRow[] {
  const m = metrics.find(x => x.metricName === metricName);
  if (!m || !Array.isArray(m.information)) return [];
  return m.information
    .filter(r => typeof r.name === 'string' && r.name)
    .map(r => ({ name: String(r.name), sessions: num(r.sessionsCount) }))
    .sort((a, b) => b.sessions - a.sessions);
}

/** Fold the raw API response into the figures the admin card shows. */
export function summarise(metrics: ClarityMetric[]): ClaritySummary {
  const signal = (name: FrustrationMetric): ClaritySignal => ({
    count: readField(metrics, name, COUNT_FIELD),
    sessionPercent: round2(readField(metrics, name, SHARE_FIELD, 'mean')),
  });

  return {
    // Counts SUM and rates AVERAGE, so that a response split by dimension
    // (one row per OS, say) totals correctly instead of reporting only the
    // first row. The daily call requests no dimension and returns a single
    // row, where both rules agree.
    sessions: readField(metrics, 'Traffic', 'totalSessionCount') ?? 0,
    botSessions: readField(metrics, 'Traffic', 'totalBotSessionCount') ?? 0,
    distinctUsers: readField(metrics, 'Traffic', 'distinctUserCount') ?? 0,
    pagesPerSession: round2(readField(metrics, 'Traffic', 'pagesPerSessionPercentage', 'mean')),
    averageScrollDepth: round2(readField(metrics, 'ScrollDepth', 'averageScrollDepth', 'mean')),
    totalTimeMinutes: readField(metrics, 'EngagementTime', 'totalTime'),
    activeTimeMinutes: readField(metrics, 'EngagementTime', 'activeTime'),
    rageClicks: signal('RageClickCount'),
    deadClicks: signal('DeadClickCount'),
    quickbackClicks: signal('QuickbackClick'),
    excessiveScroll: signal('ExcessiveScroll'),
    scriptErrors: signal('ScriptErrorCount'),
    errorClicks: signal('ErrorClickCount'),
    devices: dimension(metrics, 'Device'),
    metricsSeen: metrics.map(m => m.metricName).filter(Boolean),
  };
}

function round2(v: number | null): number | null {
  return v === null ? null : Math.round(v * 100) / 100;
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
