export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
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

export default async function BrokenLinksPage() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    return <NoAccess section="Broken links" />;
  }

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

  const inp: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 7,
    fontSize: '0.8125rem', color: '#111827', background: 'white', outline: 'none',
    fontFamily: 'monospace', minWidth: 200,
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
        Add a redirect to send a dead URL somewhere useful (goes live within a minute, no deploy), or ignore it —
        a 404 for genuinely removed content is perfectly fine and won&apos;t hurt your ranking.
      </p>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <Stat label="Open" value={open.length} />
        <Stat label="Total hits" value={totalHits} />
        <Stat label="Resolved" value={resolved.length} />
      </div>

      {open.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, color: '#166534', fontSize: '0.9375rem' }}>
          ✓ No open broken links. Every 404 has been redirected or reviewed.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Path</th>
              <th style={{ ...th, textAlign: 'right' }}>Hits</th>
              <th style={th}>Last seen</th>
              <th style={th}>Source</th>
              <th style={{ ...th, width: 360 }}>Fix</th>
            </tr>
          </thead>
          <tbody>
            {open.map(r => (
              <tr key={r.id}>
                <td style={{ ...td, fontFamily: 'monospace', wordBreak: 'break-all' }}>{r.path}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{r.hit_count}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', color: '#6b7280' }}>{ago(r.last_seen)}</td>
                <td style={{ ...td, color: '#6b7280', fontSize: '0.75rem' }}>
                  {r.last_referer
                    ? <span title={r.last_referer} style={{ wordBreak: 'break-all' }}>{r.last_referer}</span>
                    : (r.is_bot ? 'crawler' : 'direct / unknown')}
                </td>
                <td style={td}>
                  <form action={addRedirect} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="hidden" name="from_path" value={r.path} />
                    <input name="to_path" placeholder="/shop or /product/…" style={inp} aria-label={`Redirect ${r.path} to`} required />
                    <button type="submit" className="adm-btn-primary" style={{ padding: '7px 12px', fontSize: '0.8125rem', borderRadius: 7, background: '#111827', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      Redirect
                    </button>
                  </form>
                  <form action={ignoreNotFound} style={{ marginTop: 6 }}>
                    <input type="hidden" name="path" value={r.path} />
                    <button type="submit" style={{ padding: 0, fontSize: '0.75rem', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', textDecoration: 'underline' }}>
                      Ignore (it&apos;s meant to be gone)
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {resolved.length > 0 && (
        <details style={{ marginTop: 32 }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
            Resolved ({resolved.length})
          </summary>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <tbody>
              {resolved.map(r => (
                <tr key={r.id}>
                  <td style={{ ...td, fontFamily: 'monospace', color: '#6b7280', wordBreak: 'break-all' }}>{r.path}</td>
                  <td style={{ ...td, textAlign: 'right', color: '#9ca3af' }}>{r.hit_count} hits</td>
                  <td style={{ ...td, width: 120 }}>
                    <form action={reopenNotFound}>
                      <input type="hidden" name="path" value={r.path} />
                      <button type="submit" style={{ padding: 0, fontSize: '0.75rem', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', textDecoration: 'underline' }}>
                        Reopen
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
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
