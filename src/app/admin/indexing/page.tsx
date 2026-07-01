export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { getGoogleConnection } from '@/lib/google';
import { absoluteUrl } from '@/lib/seo';
import { NoAccess } from '@/components/admin/NoAccess';
import { checkIndexingNow, addTrackedUrl } from './actions';

interface Row {
  path: string;
  coverage_state: string | null;
  verdict: string | null;
  is_indexed: boolean;
  first_seen_at: string;
  last_checked_at: string | null;
  checks: number;
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

/** Deep link straight to Search Console's URL Inspection tool for one exact
 *  URL, pre-filled, so the manual "Request Indexing" click (the one step
 *  Google doesn't let us automate) takes one click instead of pasting the
 *  URL in by hand. */
function inspectionUrl(siteUrl: string, fullUrl: string): string {
  const params = new URLSearchParams({ resource_id: siteUrl, id: fullUrl });
  return `https://search.google.com/search-console/inspect?${params.toString()}`;
}

export default async function IndexingPage() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    return <NoAccess section="Indexing" />;
  }

  const conn = await getGoogleConnection();
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('gsc_url_index_status')
    .select('path, coverage_state, verdict, is_indexed, first_seen_at, last_checked_at, checks')
    .order('is_indexed', { ascending: true })
    .order('first_seen_at', { ascending: false })
    .limit(500);

  const rows = (data ?? []) as Row[];
  const pending = rows.filter(r => !r.is_indexed);
  const indexed = rows.filter(r => r.is_indexed);
  const unchecked = pending.filter(r => !r.last_checked_at).length;

  const th: React.CSSProperties = {
    textAlign: 'left', padding: '8px 10px', fontSize: '0.6875rem', fontWeight: 600,
    color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb',
  };
  const td: React.CSSProperties = { padding: '10px', fontSize: '0.8125rem', color: '#111827', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' };
  // Hoisted so the `.map()` closure below gets a plain `string`, not the
  // `string | null` TS can't narrow through `conn?.` inside a nested closure.
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
        <div style={{ padding: '40px 24px', textAlign: 'center', background: '#fef3f2', border: '1px solid #fecaca', borderRadius: 12, color: '#991b1b', fontSize: '0.9375rem' }}>
          Connect a Search Console property in <a href="/admin/settings/integrations" style={{ color: 'inherit', textDecoration: 'underline' }}>Settings → Integrations</a> first.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Stat label="Tracked" value={rows.length} />
            <Stat label="Indexed" value={indexed.length} />
            <Stat label="Pending" value={pending.length} />
            <Stat label="Not yet checked" value={unchecked} />
            <form action={checkIndexingNow}>
              <button type="submit" className="adm-btn-primary" style={{ padding: '10px 16px', fontSize: '0.8125rem', borderRadius: 8, background: '#111827', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, height: 44 }}>
                Check now
              </button>
            </form>
          </div>

          <form action={addTrackedUrl} style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            <input
              name="path" placeholder="/product/some-new-sku or /blog/some-slug" required
              style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.8125rem', fontFamily: 'monospace', flex: '1 1 320px', minWidth: 0, outline: 'none' }}
            />
            <button type="submit" style={{ padding: '9px 16px', fontSize: '0.8125rem', borderRadius: 7, background: '#fff', color: '#111827', border: '1px solid #d1d5db', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Track this URL
            </button>
          </form>

          {pending.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, color: '#166534', fontSize: '0.9375rem' }}>
              ✓ Every tracked page is indexed. New blog posts are picked up automatically.
            </div>
          ) : (
            <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Path</th>
                  <th style={th}>Status</th>
                  <th style={th}>First seen</th>
                  <th style={th}>Last checked</th>
                  <th style={{ ...th, width: 140 }}>Fix</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(r => (
                  <tr key={r.path}>
                    <td data-label="Path" style={{ ...td, fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{r.path}</td>
                    <td data-label="Status" style={{ ...td, color: '#6b7280' }}>{r.coverage_state ?? 'Not checked yet'}</td>
                    <td data-label="First seen" style={{ ...td, whiteSpace: 'nowrap', color: '#6b7280' }}>{ago(r.first_seen_at)}</td>
                    <td data-label="Last checked" style={{ ...td, whiteSpace: 'nowrap', color: '#6b7280' }}>{ago(r.last_checked_at)}</td>
                    <td style={td}>
                      <a
                        href={inspectionUrl(gscSite, absoluteUrl(r.path))}
                        target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: '0.75rem', color: '#C5286A', fontWeight: 600, textDecoration: 'underline' }}
                      >
                        Inspect in GSC →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {indexed.length > 0 && (
            <details style={{ marginTop: 32 }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                Indexed ({indexed.length})
              </summary>
              <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                <tbody>
                  {indexed.map(r => (
                    <tr key={r.path}>
                      <td data-label="Path" style={{ ...td, fontFamily: 'monospace', color: '#6b7280', overflowWrap: 'anywhere' }}>{r.path}</td>
                      <td style={{ ...td, color: '#166534' }}>{r.coverage_state}</td>
                      <td style={{ ...td, color: '#9ca3af', whiteSpace: 'nowrap' }}>{ago(r.last_checked_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 18px', minWidth: 96 }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
    </div>
  );
}
