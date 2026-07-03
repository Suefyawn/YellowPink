export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { getGoogleConnection } from '@/lib/google';
import { getQuotaState } from '@/lib/indexing-status';
import { NoAccess } from '@/components/admin/NoAccess';
import { KpiCard } from '@/components/admin/insights/KpiCard';
import { DotChip } from '@/components/admin/OrderChips';
import { ListToolbar } from '@/components/admin/ListToolbar';
import { classifyPath, PATH_TYPE_LABELS, PATH_TYPE_COLORS, type PathType } from '@/lib/path-type';
import { checkIndexingNow, addTrackedUrl } from './actions';

interface Row {
  path: string;
  coverage_state: string | null;
  verdict: string | null;
  is_indexed: boolean;
  first_seen_at: string;
  last_checked_at: string | null;
  checks: number;
  inspection_link: string | null;
}

function ago(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24); if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const SORTS: Record<string, (a: Row, b: Row) => number> = {
  first_desc: (a, b) => b.first_seen_at.localeCompare(a.first_seen_at),
  first_asc: (a, b) => a.first_seen_at.localeCompare(b.first_seen_at),
  // "Least recently checked first" surfaces the stalest statuses; never-checked
  // rows lead, they're the stalest of all.
  checked_asc: (a, b) => (a.last_checked_at ?? '').localeCompare(b.last_checked_at ?? ''),
  checked_desc: (a, b) => (b.last_checked_at ?? '').localeCompare(a.last_checked_at ?? ''),
};

export default async function IndexingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; type?: string; q?: string; sort?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    return <NoAccess section="Indexing" />;
  }
  const { view: viewParam, type: typeParam, q, sort: sortParam } = await searchParams;
  const view = ['all', 'pending', 'indexed', 'unchecked'].includes(viewParam ?? '') ? viewParam! : 'pending';
  const sort = SORTS[sortParam ?? ''] ? sortParam! : 'first_desc';

  const conn = await getGoogleConnection();
  const admin = supabaseAdmin();
  const [{ data }, apiQuota] = await Promise.all([
    admin
      .from('gsc_url_index_status')
      .select('path, coverage_state, verdict, is_indexed, first_seen_at, last_checked_at, checks, inspection_link')
      .order('first_seen_at', { ascending: false })
      .limit(500),
    getQuotaState(),
  ]);

  const rows = (data ?? []) as Row[];
  const pending = rows.filter(r => !r.is_indexed);
  const indexed = rows.filter(r => r.is_indexed);
  const unchecked = rows.filter(r => !r.last_checked_at);

  // View → type → search filtering happens in memory (≤500 rows already
  // fetched); sorts are whitelisted above.
  let list = view === 'pending' ? pending : view === 'indexed' ? indexed : view === 'unchecked' ? unchecked : rows;
  if (typeParam && typeParam !== 'all') list = list.filter(r => classifyPath(r.path) === typeParam);
  if (q) list = list.filter(r => r.path.toLowerCase().includes(q.toLowerCase()));
  list = [...list].sort(SORTS[sort]);

  const th: React.CSSProperties = {
    textAlign: 'left', padding: '8px 10px', fontSize: '0.6875rem', fontWeight: 600,
    color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb',
  };
  const td: React.CSSProperties = { padding: '10px', fontSize: '0.8125rem', color: '#111827', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' };
  const gscSite: string | null = conn?.gsc_site_url ?? null;

  return (
    <div className="adm-page" style={{ padding: '32px 36px', maxWidth: 1100 }}>
      <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Indexing</h1>
      <p style={{ margin: '8px 0 24px', fontSize: '0.875rem', color: '#6b7280', maxWidth: 720 }}>
        Google has no API to force-index an arbitrary page (only a read-only status check), so
        the daily sitemap resubmission is already automatic, but individual &ldquo;Request
        Indexing&rdquo; clicks in Search Console still have to be done by hand. This tracks which
        new pages Google has picked up and which still need that click, so you only spend your
        daily quota on the ones that actually need it.
      </p>

      {!gscSite ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, color: '#374151', fontSize: '0.9375rem' }}>
          Connect a Search Console property in <a href="/admin/settings/integrations" style={{ color: '#C5286A', textDecoration: 'underline' }}>Settings → Integrations</a> first.
        </div>
      ) : (
        <>
          {apiQuota?.exceeded && (
            <div style={{ padding: '14px 18px', marginBottom: 16, background: '#fef3f2', border: '1px solid #fecaca', borderRadius: 10, color: '#991b1b', fontSize: '0.8125rem' }}>
              <strong>Search Console API quota exceeded</strong> ({ago(apiQuota.at)}). The automated
              status check paused itself instead of burning the rest of the quota on calls that
              would also fail. It will pick back up on its own once Google&apos;s daily API limit
              resets.
            </div>
          )}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, flex: '1 1 560px' }}>
              {/* Cards double as view shortcuts. */}
              <KpiCard label="Tracked" value={rows.length} accent="#6b7280" href="/admin/indexing?view=all" />
              <KpiCard label="Indexed" value={indexed.length} accent="#15803d" href="/admin/indexing?view=indexed" />
              <KpiCard label="Pending" value={pending.length} accent="#b45309" href="/admin/indexing" />
              <KpiCard label="Not yet checked" value={unchecked.length} accent="#2563eb" href="/admin/indexing?view=unchecked" />
            </div>
            <form action={checkIndexingNow}>
              <button type="submit" style={{ padding: '10px 16px', fontSize: '0.8125rem', borderRadius: 8, background: '#111827', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, height: 44 }}>
                Check now
              </button>
            </form>
          </div>

          <form action={addTrackedUrl} style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <input
              name="path" placeholder="/product/some-new-sku or /blog/some-slug" required
              style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.8125rem', fontFamily: 'monospace', flex: '1 1 320px', minWidth: 0, outline: 'none' }}
            />
            <button type="submit" style={{ padding: '9px 16px', fontSize: '0.8125rem', borderRadius: 7, background: '#fff', color: '#111827', border: '1px solid #d1d5db', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Track this URL
            </button>
          </form>

          <Suspense fallback={null}>
            <ListToolbar
              defaultView="pending"
              views={[
                { value: 'pending', label: 'Pending', count: pending.length },
                { value: 'indexed', label: 'Indexed', count: indexed.length },
                { value: 'unchecked', label: 'Not checked', count: unchecked.length },
                { value: 'all', label: 'All', count: rows.length },
              ]}
              typeOptions={(Object.keys(PATH_TYPE_LABELS) as PathType[]).map(t => ({ value: t, label: PATH_TYPE_LABELS[t] }))}
              sortOptions={[
                { value: 'first_desc', label: 'Newest tracked first' },
                { value: 'first_asc', label: 'Oldest tracked first' },
                { value: 'checked_asc', label: 'Least recently checked' },
                { value: 'checked_desc', label: 'Most recently checked' },
              ]}
              defaultSort="first_desc"
              searchPlaceholder="Search path… e.g. /product/femeez"
            />
          </Suspense>

          {list.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', background: view === 'pending' && !q && (!typeParam || typeParam === 'all') ? '#f0fdf4' : '#f9fafb', border: `1px solid ${view === 'pending' && !q && (!typeParam || typeParam === 'all') ? '#bbf7d0' : '#e5e7eb'}`, borderRadius: 12, color: view === 'pending' && !q && (!typeParam || typeParam === 'all') ? '#166534' : '#6b7280', fontSize: '0.9375rem' }}>
              {view === 'pending' && !q && (!typeParam || typeParam === 'all')
                ? 'Every tracked page is indexed. New blog posts are picked up automatically.'
                : 'Nothing matches this view — clear the filters or try another tab.'}
            </div>
          ) : (
            <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Path</th>
                  <th style={th}>Type</th>
                  <th style={th}>Status</th>
                  <th style={th}>First seen</th>
                  <th style={th}>Last checked</th>
                  <th style={{ ...th, width: 140 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map(r => {
                  const t = classifyPath(r.path);
                  return (
                    <tr key={r.path}>
                      <td data-label="Path" style={{ ...td, fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
                        <a href={`https://www.yellowpink.pk${r.path}`} target="_blank" rel="noopener noreferrer" style={{ color: '#111827', textDecoration: 'none' }}>
                          {r.path}
                        </a>
                      </td>
                      <td data-label="Type" style={td}>
                        <DotChip label={PATH_TYPE_LABELS[t]} color={PATH_TYPE_COLORS[t]} />
                      </td>
                      <td data-label="Status" style={td}>
                        {r.is_indexed
                          ? <DotChip label="Indexed" color="#15803d" title={r.coverage_state ?? undefined} />
                          : r.last_checked_at
                            ? <DotChip label={r.coverage_state ?? 'Pending'} color="#b45309" />
                            : <DotChip label="Not checked" color="#2563eb" />}
                      </td>
                      <td data-label="First seen" style={{ ...td, whiteSpace: 'nowrap', color: '#6b7280' }}>{ago(r.first_seen_at)}</td>
                      <td data-label="Last checked" style={{ ...td, whiteSpace: 'nowrap', color: '#6b7280' }}>{ago(r.last_checked_at)}</td>
                      <td style={td}>
                        {r.inspection_link ? (
                          <a
                            href={r.inspection_link}
                            target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: '0.75rem', color: '#C5286A', fontWeight: 600, textDecoration: 'underline' }}
                          >
                            Inspect in GSC →
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Run &ldquo;Check now&rdquo; first</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
