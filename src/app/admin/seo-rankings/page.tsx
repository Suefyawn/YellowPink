export const dynamic = 'force-dynamic';

// Google ranking positions from the twice-monthly Semrush (Pakistan index)
// check — a scheduled Claude session appends a snapshot batch to
// seo_ranking_snapshots on the 1st and 15th; this page shows the latest batch
// with movement vs the previous one. Positions come from Semrush's monthly PK
// crawl, so treat them as a trend line, not a live rank tracker; Search
// Console (Dashboard → SEO) remains the ground truth for clicks.

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { can } from '@/lib/permissions';
import { NoAccess } from '@/components/admin/NoAccess';
import { EmptyState } from '@/components/admin/EmptyState';
import { fmtDatePK } from '@/lib/dates';

interface SnapRow {
  checked_at: string;
  keyword: string;
  position: number | null;
  volume: number | null;
  url: string | null;
}

export default async function SeoRankingsPage() {
  const session = await getStaffSession();
  if (!session || !can(session, 'analytics')) {
    return <NoAccess section="SEO rankings" />;
  }

  const admin = supabaseAdmin();
  // Latest two batches: newest for display, the one before for movement.
  const { data: batchRows } = await admin
    .from('seo_ranking_snapshots')
    .select('checked_at')
    .order('checked_at', { ascending: false })
    .limit(400);
  const batches = [...new Set(((batchRows ?? []) as { checked_at: string }[]).map(r => r.checked_at))].slice(0, 2);

  if (batches.length === 0) {
    return (
      <div style={{ padding: '32px 36px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '1.375rem', fontWeight: 700, color: '#111827' }}>SEO rankings</h1>
        <EmptyState title="No ranking checks yet" icon="search">
          The scheduled check runs on the 1st and 15th of each month and its results will appear here.
        </EmptyState>
      </div>
    );
  }

  const { data: rows } = await admin
    .from('seo_ranking_snapshots')
    .select('checked_at, keyword, position, volume, url')
    .in('checked_at', batches)
    .order('volume', { ascending: false });
  const all = (rows ?? []) as SnapRow[];
  const latest = all.filter(r => r.checked_at === batches[0]);
  const prevMap = new Map(all.filter(r => r.checked_at === batches[1]).map(r => [r.keyword, r.position]));

  const move = (r: SnapRow): { label: string; color: string } => {
    if (batches.length < 2 || !prevMap.has(r.keyword)) return { label: r.position != null ? 'new' : '—', color: '#6b7280' };
    const prev = prevMap.get(r.keyword) ?? null;
    if (r.position == null && prev == null) return { label: '—', color: '#9ca3af' };
    if (r.position == null) return { label: 'dropped out', color: '#b91c1c' };
    if (prev == null) return { label: 'entered top 100', color: '#15803d' };
    const d = Math.round(Number(prev) - Number(r.position));
    if (d === 0) return { label: '=', color: '#6b7280' };
    return d > 0 ? { label: `▲ ${d}`, color: '#15803d' } : { label: `▼ ${-d}`, color: '#b91c1c' };
  };

  const pathOf = (u: string | null) => {
    if (!u) return '';
    try { return new URL(u).pathname; } catch { return u; }
  };

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', borderBottom: '1px solid #e5e7eb' };
  const td: React.CSSProperties = { padding: '9px 10px', fontSize: '0.8125rem', color: '#111827', borderBottom: '1px solid #f3f4f6' };

  return (
    <div style={{ padding: '32px 36px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.375rem', fontWeight: 700, color: '#111827' }}>SEO rankings</h1>
      <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: '#6b7280', maxWidth: 640 }}>
        Google positions for yellowpink.pk from the Semrush Pakistan index, checked on the 1st and 15th of each month.
        Last check: {fmtDatePK(batches[0])}{batches[1] ? ` · movement vs ${fmtDatePK(batches[1])}` : ''}.
        Position 1–10 is page one. Semrush refreshes its Pakistan crawl monthly, so slow movement is normal.
      </p>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr>
                <th style={th}>Keyword</th>
                <th style={{ ...th, textAlign: 'right' }}>Searches / month</th>
                <th style={{ ...th, textAlign: 'right' }}>Position</th>
                <th style={{ ...th, textAlign: 'right' }}>Change</th>
                <th style={th}>Page</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((r, i) => {
                const m = move(r);
                return (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 600 }}>{r.keyword}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.volume?.toLocaleString() ?? '—'}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: r.position != null && r.position <= 10 ? '#15803d' : '#111827' }}>
                      {r.position != null ? Math.round(Number(r.position)) : '>100'}
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: m.color, fontWeight: 600 }}>{m.label}</td>
                    <td style={{ ...td, color: '#6b7280', fontSize: '0.75rem', overflowWrap: 'anywhere' }}>{pathOf(r.url)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
