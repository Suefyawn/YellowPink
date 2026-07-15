// Shared shapes for the Traffic & Search dashboard. This module is imported
// by BOTH the server assembler (lib/traffic-insights.ts, server-only) and the
// client chart component, so it must stay free of server imports.

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

/** Mirrors lib/google.ts GscRow (kept local so the client bundle never
 *  imports the server-only Google module, even for a type). */
export interface GscStatRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
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
  topQueries: GscStatRow[];
  /** Top pages in search, last 28 days (clicks desc). */
  topPages: GscStatRow[];
  indexing: IndexingBucket[];
}
