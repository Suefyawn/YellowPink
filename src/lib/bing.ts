// ── Bing Webmaster Tools API ────────────────────────────────────────────────
// Bing is the store's second search engine (28 referring sessions in the last
// 30 days on PostHog, and it is the index behind DuckDuckGo, Yahoo and the
// Copilot answers). IndexNow (src/lib/indexing.ts) already pushes every new
// URL to Bing; this module is the READ side plus Bing's own URL submission
// endpoint: query/page/crawl stats and the submission quota, so the admin
// can see Bing the way it sees Google Search Console.
//
// Auth is a single API key the owner generates in Bing Webmaster Tools
// (Settings → API access → Generate). It is a secret, so it lives in the
// BING_WEBMASTER_API_KEY env var, never in site_settings (that table is
// readable by the anon key). Absent key = every call here reports
// "not configured" and the dashboard shows the setup hint instead.
//
// API shape (JSON flavour): GET https://ssl.bing.com/webmaster/api.svc/json/
// <Method>?siteUrl=…&apikey=…, POST with a JSON body for writes. Responses are
// wrapped as { d: … }; dates arrive as WCF "/Date(1693526400000-0700)/"
// strings, parsed below. Errors come back as { ErrorCode, Message }.

// Server-side only by usage (dashboard actions, cron, admin widgets); no
// 'server-only' marker so the pure helpers stay unit-testable under vitest.
import { SITE_URL } from '@/lib/seo';

const API_BASE = 'https://ssl.bing.com/webmaster/api.svc/json';

export function bingApiKey(): string | null {
  const k = process.env.BING_WEBMASTER_API_KEY?.trim();
  return k ? k : null;
}

export function isBingConfigured(): boolean {
  return bingApiKey() !== null;
}

/** The site as registered in Bing Webmaster Tools: origin with a trailing
 *  slash. Override with BING_SITE_URL if the property was added differently
 *  (e.g. the apex domain). */
export function bingSiteUrl(): string {
  const v = process.env.BING_SITE_URL?.trim();
  if (v) return v;
  return `${new URL(SITE_URL).origin}/`;
}

export class BingApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = 'BingApiError';
  }
}

/** WCF date ("/Date(1693526400000-0700)/") → ISO day string. Plain ISO
 *  strings pass through; anything unparseable returns null. */
export function parseBingDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /\/Date\((-?\d+)(?:[+-]\d{4})?\)\//.exec(v);
  const ms = m ? Number(m[1]) : Date.parse(v);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

async function call<T>(method: string, opts: { body?: unknown; query?: Record<string, string> } = {}): Promise<T> {
  const key = bingApiKey();
  if (!key) throw new BingApiError('Bing Webmaster Tools is not configured (BING_WEBMASTER_API_KEY).', 0, 'not_configured');
  const qs = new URLSearchParams({ apikey: key, ...(opts.query ?? {}) });
  const res = await fetch(`${API_BASE}/${method}?${qs.toString()}`, {
    method: opts.body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    // Stats are daily aggregates; never let a stale edge copy mask a refresh.
    cache: 'no-store',
  });
  let json: unknown = null;
  try { json = await res.json(); } catch { /* non-JSON error page */ }
  const err = json as { ErrorCode?: string | number; Message?: string } | null;
  if (!res.ok || (err && err.ErrorCode !== undefined && err.ErrorCode !== 0)) {
    throw new BingApiError(
      `Bing ${method} failed: ${err?.Message ?? `HTTP ${res.status}`}`,
      res.status,
      err?.ErrorCode !== undefined ? String(err.ErrorCode) : undefined,
    );
  }
  return ((json as { d?: T } | null)?.d ?? json) as T;
}

// ── Reports ────────────────────────────────────────────────────────────────

export interface BingDay { day: string; clicks: number; impressions: number }
export interface BingQueryRow { query: string; clicks: number; impressions: number; avgPosition: number | null }
export interface BingPageRow { url: string; clicks: number; impressions: number; avgPosition: number | null }
export interface BingCrawlDay {
  day: string;
  crawledPages: number;
  inIndex: number;
  crawlErrors: number;
  inLinks: number;
  blockedByRobots: number;
  http2xx: number; http301: number; http302: number; http4xx: number; http5xx: number;
}
export interface BingQuota { daily: number; monthly: number }

interface RawTraffic { Date: string; Clicks: number; Impressions: number }
interface RawQuery { Query: string; Clicks: number; Impressions: number; AvgClickPosition?: number; AvgImpressionPosition?: number; Date?: string }
interface RawPage { Query: string; Clicks: number; Impressions: number; AvgClickPosition?: number; AvgImpressionPosition?: number }
interface RawCrawl {
  Date: string; CrawledPages: number; InIndex: number; InLinks: number; CrawlErrors: number;
  BlockedByRobotsTxt: number; Code2xx: number; Code301: number; Code302: number; Code4xx: number; Code5xx: number;
}
interface RawQuota { DailyQuota: number; MonthlyQuota: number }

/** Daily clicks + impressions for the site (Bing keeps ~6 months). */
export async function getRankAndTrafficStats(siteUrl = bingSiteUrl()): Promise<BingDay[]> {
  const rows = await call<RawTraffic[]>('GetRankAndTrafficStats', { query: { siteUrl } });
  return (rows ?? [])
    .map(r => ({ day: parseBingDate(r.Date) ?? '', clicks: r.Clicks ?? 0, impressions: r.Impressions ?? 0 }))
    .filter(r => r.day)
    .sort((a, b) => a.day.localeCompare(b.day));
}

/** Top queries (Bing returns the trailing window it keeps, one row per query). */
export async function getQueryStats(siteUrl = bingSiteUrl()): Promise<BingQueryRow[]> {
  const rows = await call<RawQuery[]>('GetQueryStats', { query: { siteUrl } });
  return (rows ?? []).map(r => ({
    query: r.Query,
    clicks: r.Clicks ?? 0,
    impressions: r.Impressions ?? 0,
    avgPosition: r.AvgImpressionPosition ?? r.AvgClickPosition ?? null,
  }));
}

/** Top pages by impressions. Bing's page report reuses the "Query" field
 *  name for the URL. */
export async function getPageStats(siteUrl = bingSiteUrl()): Promise<BingPageRow[]> {
  const rows = await call<RawPage[]>('GetPageStats', { query: { siteUrl } });
  return (rows ?? []).map(r => ({
    url: r.Query,
    clicks: r.Clicks ?? 0,
    impressions: r.Impressions ?? 0,
    avgPosition: r.AvgImpressionPosition ?? r.AvgClickPosition ?? null,
  }));
}

/** Crawl health per day: pages crawled, pages in the index, errors, robots
 *  blocks and the HTTP status mix Bingbot met. */
export async function getCrawlStats(siteUrl = bingSiteUrl()): Promise<BingCrawlDay[]> {
  const rows = await call<RawCrawl[]>('GetCrawlStats', { query: { siteUrl } });
  return (rows ?? [])
    .map(r => ({
      day: parseBingDate(r.Date) ?? '',
      crawledPages: r.CrawledPages ?? 0, inIndex: r.InIndex ?? 0, crawlErrors: r.CrawlErrors ?? 0,
      inLinks: r.InLinks ?? 0, blockedByRobots: r.BlockedByRobotsTxt ?? 0,
      http2xx: r.Code2xx ?? 0, http301: r.Code301 ?? 0, http302: r.Code302 ?? 0, http4xx: r.Code4xx ?? 0, http5xx: r.Code5xx ?? 0,
    }))
    .filter(r => r.day)
    .sort((a, b) => a.day.localeCompare(b.day));
}

/** How many URLs the site may still push through Bing's own submission API
 *  today / this month. Also the cheapest "is the key valid" probe. */
export async function getUrlSubmissionQuota(siteUrl = bingSiteUrl()): Promise<BingQuota> {
  const q = await call<RawQuota>('GetUrlSubmissionQuota', { query: { siteUrl } });
  return { daily: q?.DailyQuota ?? 0, monthly: q?.MonthlyQuota ?? 0 };
}

/** Bing's URL Submission API (distinct from IndexNow): up to 500 URLs per
 *  call, counted against the quota above. IndexNow already reaches Bing for
 *  free, so indexing.ts only calls this as a second, authenticated channel
 *  when the key is present. */
export async function submitUrlBatch(urls: string[], siteUrl = bingSiteUrl()): Promise<number> {
  const batch = [...new Set(urls)].slice(0, 500);
  if (batch.length === 0) return 0;
  await call<unknown>('SubmitUrlBatch', { body: { siteUrl, urlList: batch } });
  return batch.length;
}
