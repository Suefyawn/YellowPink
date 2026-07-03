export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { KpiCard } from '@/components/admin/insights/KpiCard';
import { DotChip } from '@/components/admin/OrderChips';
import { ListToolbar } from '@/components/admin/ListToolbar';
import { classifyPath, PATH_TYPE_LABELS, PATH_TYPE_COLORS, type PathType } from '@/lib/path-type';
import { addRedirect, ignoreNotFound, reopenNotFound } from './actions';

interface Row {
  id: string;
  path: string;
  hit_count: number;
  first_seen: string;
  last_seen: string;
  last_referer: string | null;
  is_bot: boolean;
  resolved: boolean;
}

function ago(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24); if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const BL_SORTS: Record<string, (a: Row, b: Row) => number> = {
  hits_desc: (a, b) => b.hit_count - a.hit_count,
  recent: (a, b) => b.last_seen.localeCompare(a.last_seen),
  oldest: (a, b) => a.last_seen.localeCompare(b.last_seen),
};

export default async function BrokenLinksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; type?: string; q?: string; sort?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    return <NoAccess section="Broken links" />;
  }
  const { view: viewParam, type: typeParam, q, sort: sortParam } = await searchParams;
  const view = viewParam === 'resolved' ? 'resolved' : 'open';
  const sort = BL_SORTS[sortParam ?? ''] ? sortParam! : 'hits_desc';

  const admin = supabaseAdmin();
  const { data } = await admin
    .from('not_found_log')
    .select('id, path, hit_count, first_seen, last_seen, last_referer, is_bot, resolved')
    .order('resolved', { ascending: true })
    .order('hit_count', { ascending: false })
    .order('last_seen', { ascending: false })
    .limit(300);

  const rows = (data ?? []) as Row[];
  const open = rows.filter(r => !r.resolved);
  const resolved = rows.filter(r => r.resolved);
  const totalHits = open.reduce((n, r) => n + r.hit_count, 0);

  // View → type → search filtering in memory (≤300 rows already fetched).
  let list = view === 'resolved' ? resolved : open;
  if (typeParam && typeParam !== 'all') list = list.filter(r => classifyPath(r.path) === typeParam);
  if (q) list = list.filter(r => r.path.toLowerCase().includes(q.toLowerCase()));
  list = [...list].sort(BL_SORTS[sort]);

  const inp: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 7,
    fontSize: '0.8125rem', color: '#111827', background: 'white', outline: 'none',
    fontFamily: 'monospace', flex: '1 1 auto', minWidth: 0,
  };
  const th: React.CSSProperties = {
    textAlign: 'left', padding: '8px 10px', fontSize: '0.6875rem', fontWeight: 600,
    color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb',
  };
  const td: React.CSSProperties = { padding: '10px', fontSize: '0.8125rem', color: '#111827', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' };

  return (
    <div className="adm-page" style={{ padding: '32px 36px', maxWidth: 1100 }}>
      <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Broken links</h1>
      <p style={{ margin: '8px 0 24px', fontSize: '0.875rem', color: '#6b7280', maxWidth: 720 }}>
        URLs on the store that returned <strong>404</strong>, captured automatically when a visitor or crawler hits them.
        Add a redirect to send a dead URL somewhere useful (goes live within a minute, no deploy), or ignore it,         a 404 for genuinely removed content is perfectly fine and won&apos;t hurt your ranking.
      </p>

      <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Open" value={open.length} accent="#dc2626" />
        <KpiCard label="Total hits" value={totalHits} accent="#b45309" />
        <KpiCard label="Resolved" value={resolved.length} accent="#15803d" />
      </div>

      <Suspense fallback={null}>
        <ListToolbar
          defaultView="open"
          views={[
            { value: 'open', label: 'Open', count: open.length },
            { value: 'resolved', label: 'Resolved', count: resolved.length },
          ]}
          typeOptions={(Object.keys(PATH_TYPE_LABELS) as PathType[]).map(t => ({ value: t, label: PATH_TYPE_LABELS[t] }))}
          sortOptions={[
            { value: 'hits_desc', label: 'Most hits first' },
            { value: 'recent', label: 'Recently seen first' },
            { value: 'oldest', label: 'Oldest first' },
          ]}
          defaultSort="hits_desc"
          searchPlaceholder="Search path… e.g. /tag/"
        />
      </Suspense>

      {list.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', background: view === 'open' && !q && (!typeParam || typeParam === 'all') ? '#f0fdf4' : '#f9fafb', border: `1px solid ${view === 'open' && !q && (!typeParam || typeParam === 'all') ? '#bbf7d0' : '#e5e7eb'}`, borderRadius: 12, color: view === 'open' && !q && (!typeParam || typeParam === 'all') ? '#166534' : '#6b7280', fontSize: '0.9375rem' }}>
          {view === 'open' && !q && (!typeParam || typeParam === 'all')
            ? 'No open broken links. Every 404 has been redirected or reviewed.'
            : 'Nothing matches this view — clear the filters or try another tab.'}
        </div>
      ) : view === 'open' ? (
        <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Path</th>
              <th style={th}>Type</th>
              <th style={{ ...th, textAlign: 'right' }}>Hits</th>
              <th style={th}>Last seen</th>
              <th style={th}>Source</th>
              <th style={{ ...th, width: 360 }}>Fix</th>
            </tr>
          </thead>
          <tbody>
            {list.map(r => {
              const t = classifyPath(r.path);
              return (
                <tr key={r.id}>
                  <td data-label="Path" style={{ ...td, fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{r.path}</td>
                  <td data-label="Type" style={td}>
                    <DotChip label={PATH_TYPE_LABELS[t]} color={PATH_TYPE_COLORS[t]} />
                  </td>
                  <td data-label="Hits" style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{r.hit_count}</td>
                  <td data-label="Last seen" style={{ ...td, whiteSpace: 'nowrap', color: '#6b7280' }}>{ago(r.last_seen)}</td>
                  <td data-label="Source" style={{ ...td, color: '#6b7280', fontSize: '0.75rem' }}>
                    {r.last_referer
                      ? <span title={r.last_referer} style={{ overflowWrap: 'anywhere' }}>{r.last_referer}</span>
                      : (r.is_bot ? 'crawler' : 'direct / unknown')}
                  </td>
                  <td className="bl-fix-cell" style={td}>
                    <form action={addRedirect} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input type="hidden" name="from_path" value={r.path} />
                      <input name="to_path" placeholder="/shop or /product/…" style={inp} aria-label={`Redirect ${r.path} to`} required />
                      <button type="submit" style={{ padding: '7px 14px', fontSize: '0.8125rem', borderRadius: 7, background: '#111827', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        Redirect
                      </button>
                    </form>
                    <form action={ignoreNotFound} style={{ marginTop: 8 }}>
                      <input type="hidden" name="path" value={r.path} />
                      <button type="submit" style={{ padding: 0, fontSize: '0.75rem', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', textDecoration: 'underline' }}>
                        Ignore (it&apos;s meant to be gone)
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Path</th>
              <th style={th}>Type</th>
              <th style={{ ...th, textAlign: 'right' }}>Hits</th>
              <th style={th}>Last seen</th>
              <th style={{ ...th, width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {list.map(r => {
              const t = classifyPath(r.path);
              return (
                <tr key={r.id}>
                  <td data-label="Path" style={{ ...td, fontFamily: 'monospace', color: '#6b7280', overflowWrap: 'anywhere' }}>{r.path}</td>
                  <td data-label="Type" style={td}>
                    <DotChip label={PATH_TYPE_LABELS[t]} color={PATH_TYPE_COLORS[t]} />
                  </td>
                  <td data-label="Hits" style={{ ...td, textAlign: 'right', color: '#9ca3af' }}>{r.hit_count}</td>
                  <td data-label="Last seen" style={{ ...td, whiteSpace: 'nowrap', color: '#9ca3af' }}>{ago(r.last_seen)}</td>
                  <td style={td}>
                    <form action={reopenNotFound}>
                      <input type="hidden" name="path" value={r.path} />
                      <button type="submit" style={{ padding: 0, fontSize: '0.75rem', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', textDecoration: 'underline' }}>
                        Reopen
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
