import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { getGoogleConnection, gscQuery, ga4RunReport, type GscRow } from '@/lib/google';
import { log } from '@/lib/logger';

// ============================================================================
// Data assembly for the Traffic & Search dashboard (admin → Analytics →
// Traffic). One server fetch returns a 180-day daily window so the client
// can slice 7/30/90-day ranges (and their prior-period baselines) instantly,
// the same pattern as the dashboard OverviewChart.
//
// Sources, in order of truth:
//   GA4  — sessions per day per default channel group (the "is SEO growing
//          vs direct" series the owner asked for).
//   GSC  — clicks/impressions/CTR/position per day + top queries and pages.
//   DB   — seo_daily_metrics as the fallback when Google isn't connected,
//          and gsc_url_index_status for the indexing panel.
//
// Side effect: fresh GSC/GA4 dailies are upserted into seo_daily_metrics so
// gaps from a dead connection (July 11–14 was one) heal on the next view
// instead of staying holes in every trend forever.
// ============================================================================

/** Channel labels are GA4's default channel groups, normalised to the fixed
 *  set the chart knows. Order here is the palette order — never re-sort. */
export const CHANNELS = [
  'Organic Search',
  'Direct',
  'Referral',
  'Organic Social',
  'Paid',
  'Email',
  'Other',
] as const;
export type Channel = (typeof CHANNELS)[number];

function normaliseChannel(ga4Group: string): Channel {
  const g = ga4Group.toLowerCase();
  if (g.includes('organic search')) return 'Organic Search';
  if (g === 'direct') return 'Direct';
  if (g.includes('referral')) return 'Referral';
  if (g.includes('organic social')) return 'Organic Social';
  if (g.includes('paid') || g.includes('display') || g.includes('cross-network')) return 'Paid';
  if (g.includes('email')) return 'Email';
  return 'Other';
}

export interface ChannelDay {
  date: string; // YYYY-MM-DD
  sessions: Partial<Record<Channel, number>>;
}

export interface GscDay {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;      // 0..1
  position: number; // average
}

export interface IndexingBucket { state: string; count: number }

export interface TrafficSearchData {
  /** False when the Google account isn't connected (charts fall back to the
   *  seo_daily_metrics history where possible). */
  connected: boolean;
  /** Ascending by date, up to 180 days. Empty when GA4 unavailable. */
  channelDaily: ChannelDay[];
  /** Ascending by date, up to 180 days. From GSC, else seo_daily_metrics. */
  gscDaily: GscDay[];
  /** Top search queries, last 28 days (clicks desc). */
  topQueries: GscRow[];
  /** Top pages in search, last 28 days (clicks desc). */
  topPages: GscRow[];
  indexing: IndexingBucket[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d; };

/** "20260715" (GA4 date dimension) → "2026-07-15". */
function ga4Date(v: string): string {
  return v.length === 8 ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : v;
}

async function fetchIndexing(): Promise<IndexingBucket[]> {
  const { data } = await supabaseAdmin()
    .from('gsc_url_index_status')
    .select('coverage_state');
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { coverage_state: string | null }[]) {
    const key = row.coverage_state ?? 'Not checked yet';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count);
}

/** Fallback GSC series from our own daily snapshots (nulls skipped). */
async function gscDailyFromSnapshots(): Promise<GscDay[]> {
  const { data } = await supabaseAdmin()
    .from('seo_daily_metrics')
    .select('day, gsc_clicks, gsc_impressions, gsc_ctr, gsc_position')
    .gte('day', iso(daysAgo(180)))
    .order('day', { ascending: true });
  return ((data ?? []) as Array<{ day: string; gsc_clicks: number | null; gsc_impressions: number | null; gsc_ctr: number | null; gsc_position: number | null }>)
    .filter(r => r.gsc_clicks != null || r.gsc_impressions != null)
    .map(r => ({
      date: r.day,
      clicks: Number(r.gsc_clicks ?? 0),
      impressions: Number(r.gsc_impressions ?? 0),
      ctr: Number(r.gsc_ctr ?? 0),
      position: Number(r.gsc_position ?? 0),
    }));
}

/** Heal seo_daily_metrics with whatever fresh dailies this fetch produced,
 *  so trend history survives connection outages. Never throws. */
async function backfillSnapshots(gscDaily: GscDay[], channelDaily: ChannelDay[]): Promise<void> {
  try {
    if (gscDaily.length === 0 && channelDaily.length === 0) return;
    const byDay = new Map<string, Record<string, unknown>>();
    for (const d of gscDaily) {
      byDay.set(d.date, {
        day: d.date,
        gsc_clicks: d.clicks,
        gsc_impressions: d.impressions,
        gsc_ctr: d.ctr,
        gsc_position: d.position,
      });
    }
    for (const c of channelDaily) {
      const total = Object.values(c.sessions).reduce((s, v) => s + (v ?? 0), 0);
      const organic = c.sessions['Organic Search'] ?? 0;
      const row = byDay.get(c.date) ?? { day: c.date };
      byDay.set(c.date, { ...row, ga4_sessions: total, ga4_organic_sessions: organic });
    }
    // Don't overwrite today's partial figures with a bigger-window fetch, the
    // daily cron owns "yesterday and earlier"; we only heal those same days.
    const today = iso(new Date());
    const rows = [...byDay.values()].filter(r => (r.day as string) < today);
    if (rows.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin().from('seo_daily_metrics') as any).upsert(rows, { onConflict: 'day' });
  } catch (err) {
    log.warn('traffic_insights.backfill_failed', { err: err instanceof Error ? err.message : String(err) });
  }
}

export async function getTrafficSearchData(): Promise<TrafficSearchData> {
  const conn = await getGoogleConnection();
  const indexing = await fetchIndexing();

  if (!conn) {
    return { connected: false, channelDaily: [], gscDaily: await gscDailyFromSnapshots(), topQueries: [], topPages: [], indexing };
  }

  // GSC data lags ~2 days; end both windows there so the tail isn't zeros.
  const gscEnd = iso(daysAgo(2));
  const gscStart = iso(daysAgo(2 + 180));
  const gscTopStart = iso(daysAgo(2 + 28));

  let channelDaily: ChannelDay[] = [];
  let gscDaily: GscDay[] = [];
  let topQueries: GscRow[] = [];
  let topPages: GscRow[] = [];

  if (conn.ga4_property_id) {
    try {
      const rows = await ga4RunReport({
        propertyId: conn.ga4_property_id,
        startDate: iso(daysAgo(180)),
        endDate: iso(daysAgo(0)),
        dimensions: ['date', 'sessionDefaultChannelGroup'],
        metrics: ['sessions'],
        limit: 5000,
      });
      const byDate = new Map<string, ChannelDay>();
      for (const r of rows) {
        const date = ga4Date(r.dimensions[0] ?? '');
        const channel = normaliseChannel(r.dimensions[1] ?? '');
        if (!date) continue;
        const day = byDate.get(date) ?? { date, sessions: {} };
        day.sessions[channel] = (day.sessions[channel] ?? 0) + (r.metrics[0] ?? 0);
        byDate.set(date, day);
      }
      channelDaily = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    } catch (err) {
      log.warn('traffic_insights.ga4_failed', { err: err instanceof Error ? err.message : String(err) });
    }
  }

  if (conn.gsc_site_url) {
    const site = conn.gsc_site_url;
    try {
      const rows = await gscQuery({ siteUrl: site, startDate: gscStart, endDate: gscEnd, dimensions: ['date'], rowLimit: 200 });
      gscDaily = rows
        .map(r => ({ date: r.keys[0] ?? '', clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }))
        .filter(d => d.date)
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (err) {
      log.warn('traffic_insights.gsc_daily_failed', { err: err instanceof Error ? err.message : String(err) });
      gscDaily = await gscDailyFromSnapshots();
    }
    try {
      topQueries = await gscQuery({ siteUrl: site, startDate: gscTopStart, endDate: gscEnd, dimensions: ['query'], rowLimit: 20 });
    } catch (err) {
      log.warn('traffic_insights.gsc_queries_failed', { err: err instanceof Error ? err.message : String(err) });
    }
    try {
      topPages = await gscQuery({ siteUrl: site, startDate: gscTopStart, endDate: gscEnd, dimensions: ['page'], rowLimit: 20 });
    } catch (err) {
      log.warn('traffic_insights.gsc_pages_failed', { err: err instanceof Error ? err.message : String(err) });
    }
  } else {
    gscDaily = await gscDailyFromSnapshots();
  }

  await backfillSnapshots(gscDaily, channelDaily);

  return { connected: true, channelDaily, gscDaily, topQueries, topPages, indexing };
}
