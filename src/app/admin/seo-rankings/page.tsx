export const dynamic = 'force-dynamic';

// SEO rankings: tracked keywords with two data sources side by side.
//
//  • Semrush PK index — the twice-monthly scheduled check (1st and 15th)
//    appends a batch to seo_ranking_snapshots. Slow-moving trend line; the
//    keyword list it checks comes from seo_tracked_keywords (managed on this
//    page — additions are picked up on the next run).
//  • Search Console — ground truth. The analytics cron keeps a 28-day query
//    aggregate in analytics_cache ('gsc') and per-day history in
//    gsc_query_snapshots, which drives the daily-position sparklines and the
//    "untracked opportunities" list. No Google API calls happen per-view.

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { can } from '@/lib/permissions';
import { NoAccess } from '@/components/admin/NoAccess';
import { EmptyState } from '@/components/admin/EmptyState';
import { fmtDatePK } from '@/lib/dates';
import { SeoRankingsClient, type KeywordRow, type Opportunity } from '@/components/admin/SeoRankingsClient';

interface SnapRow { checked_at: string; keyword: string; position: number | null; volume: number | null; url: string | null }
interface TrackedRow { keyword: string; volume: number | null; target_url: string | null }
interface GscCacheQuery { query: string; clicks: number; impressions: number; ctr: number; position: number }
interface GscDaily { day: string; query: string; position: number | null }

// Queries about the store itself say nothing about content rankings.
const BRANDED = /yellow\s*pink|yellowpink/i;

export default async function SeoRankingsPage() {
  const session = await getStaffSession();
  if (!session || !can(session, 'analytics')) {
    return <NoAccess section="SEO rankings" />;
  }

  const admin = supabaseAdmin();
  // Daily GSC history: newest rows first, windowed per keyword below (last 28
  // points each). No Date.now() here — render must stay pure, and the data
  // carries its own dates.
  const [trackedRes, snapRes, gscCacheRes, gscDailyRes] = await Promise.all([
    admin.from('seo_tracked_keywords').select('keyword, volume, target_url').eq('active', true),
    admin.from('seo_ranking_snapshots').select('checked_at, keyword, position, volume, url').order('checked_at', { ascending: false }).limit(2000),
    admin.from('analytics_cache').select('data, updated_at').eq('key', 'gsc').maybeSingle(),
    admin.from('gsc_query_snapshots').select('day, query, position').order('day', { ascending: false }).limit(15000),
  ]);

  const tracked = (trackedRes.data ?? []) as TrackedRow[];
  const snaps = (snapRes.data ?? []) as SnapRow[];
  const gscQueries = ((gscCacheRes.data as { data?: { queries?: GscCacheQuery[]; range?: { start: string; end: string } } } | null)?.data?.queries ?? []);
  const gscRange = (gscCacheRes.data as { data?: { range?: { start: string; end: string } } } | null)?.data?.range ?? null;
  const gscDaily = (gscDailyRes.data ?? []) as GscDaily[];

  if (tracked.length === 0 && snaps.length === 0) {
    return (
      <div style={{ padding: '32px 36px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '1.375rem', fontWeight: 700, color: '#111827' }}>SEO rankings</h1>
        <EmptyState title="No tracked keywords yet" icon="search">
          Add keywords below or wait for the scheduled check (1st and 15th of each month) to seed the list.
        </EmptyState>
        <SeoRankingsClient rows={[]} opportunities={[]} />
      </div>
    );
  }

  // Latest two Semrush batches give position + movement.
  const batchDates = [...new Set(snaps.map(s => s.checked_at))].sort().reverse();
  const [latestBatch, prevBatch] = batchDates;
  const latestSnap = new Map(snaps.filter(s => s.checked_at === latestBatch).map(s => [s.keyword.toLowerCase(), s]));
  const prevSnap = new Map(snaps.filter(s => s.checked_at === prevBatch).map(s => [s.keyword.toLowerCase(), s]));

  // GSC lookups, keyed case-insensitively.
  const gscByQuery = new Map(gscQueries.map(q => [q.query.toLowerCase(), q]));
  const dailyByQuery = new Map<string, { day: string; position: number }[]>();
  for (const d of gscDaily) {
    if (d.position == null) continue;
    const k = d.query.toLowerCase();
    if (!dailyByQuery.has(k)) dailyByQuery.set(k, []);
    const list = dailyByQuery.get(k)!;
    // Rows arrive newest-first; cap each keyword at a 28-point window.
    if (list.length < 28) list.push({ day: d.day, position: Number(d.position) });
  }
  // Flip to oldest→newest for the sparklines.
  for (const list of dailyByQuery.values()) list.reverse();

  const rows: KeywordRow[] = tracked.map(t => {
    const k = t.keyword.toLowerCase();
    const snap = latestSnap.get(k);
    const prev = prevSnap.get(k);
    const gsc = gscByQuery.get(k);
    return {
      keyword: t.keyword,
      volume: snap?.volume ?? t.volume,
      position: snap?.position != null ? Number(snap.position) : null,
      prevPosition: prev?.position != null ? Number(prev.position) : null,
      inLatestBatch: latestSnap.has(k),
      url: snap?.url ? pathOf(snap.url) : t.target_url ? pathOf(t.target_url) : null,
      gscPosition: gsc?.position != null ? Number(gsc.position) : null,
      clicks: gsc?.clicks ?? null,
      impressions: gsc?.impressions ?? null,
      spark: dailyByQuery.get(k) ?? [],
    };
  });

  // Summary tiles.
  const ranked = rows.filter(r => r.position != null);
  const tiles = [
    { label: 'Tracked keywords', value: rows.length },
    { label: 'Top 3', value: ranked.filter(r => r.position! <= 3).length, color: '#15803d' },
    { label: 'Page 1', value: ranked.filter(r => r.position! <= 10).length, color: '#15803d' },
    { label: 'Page 2', value: ranked.filter(r => r.position! > 10 && r.position! <= 20).length },
    { label: 'Clicks, 28 days', value: rows.reduce((s, r) => s + (r.clicks ?? 0), 0) },
  ];

  // Opportunities: GSC queries with real impressions that nobody tracks yet.
  const trackedSet = new Set(rows.map(r => r.keyword.toLowerCase()));
  const opportunities: Opportunity[] = gscQueries
    .filter(q => !trackedSet.has(q.query.toLowerCase()) && !BRANDED.test(q.query) && q.impressions >= 20)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 12)
    .map(q => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, position: q.position ?? null }));

  return (
    <div style={{ padding: '32px 36px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.375rem', fontWeight: 700, color: '#111827' }}>SEO rankings</h1>
      <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: '#6b7280', maxWidth: 720 }}>
        Semrush positions (Pakistan index) refresh on the 1st and 15th
        {latestBatch ? <> — last check {fmtDatePK(latestBatch)}{prevBatch ? `, movement vs ${fmtDatePK(prevBatch)}` : ''}</> : null}.
        Google columns come from Search Console{gscRange ? ` (${gscRange.start} to ${gscRange.end})` : ''} and update daily; the
        trend line is the daily Google position. Keywords added here are picked up by the next scheduled check.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20, maxWidth: 860 }}>
        {tiles.map(t => (
          <div key={t.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: t.color ?? '#111827', fontVariantNumeric: 'tabular-nums' }}>{t.value.toLocaleString()}</div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280' }}>{t.label}</div>
          </div>
        ))}
      </div>

      <SeoRankingsClient rows={rows} opportunities={opportunities} />
    </div>
  );
}

function pathOf(u: string): string {
  try { return new URL(u).pathname; } catch { return u; }
}
