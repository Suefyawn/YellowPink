import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';
import { AdminIcon } from '@/components/ui/AdminIcon';

// "How engaged is the traffic, and where does it land" — session-quality
// signals from the rolling 7-day PostHog snapshot: pages per session, average
// session length, bounce rate (single-pageview sessions), and the top entry
// (landing) pages where sessions actually begin.

interface Engagement { sessions: number; pagesPerSession: number; avgSessionSeconds: number; bounceRate: number; }
interface EntryPage { path: string; sessions: number; }
interface EntryData { items: EntryPage[]; }

const cardStyle = {
  background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '24px',
};

function fmtDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export async function EngagementWidget() {
  const [eng, entry] = await Promise.all([
    readAnalyticsCache<Engagement>('posthog_engagement'),
    readAnalyticsCache<EntryData>('posthog_entry_pages'),
  ]);
  const e = eng?.data;
  const entryPages = entry?.data.items ?? [];
  const maxEntry = Math.max(...entryPages.map(p => p.sessions), 1);

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#C5286A', display: 'inline-flex' }}><AdminIcon name="history" size={16} /></span>
            Engagement &amp; landing pages
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
            Last 7 days{eng ? ` · refreshed ${timeAgoShort(eng.updatedAt)}` : ''}
          </p>
        </div>
      </div>

      {!e || e.sessions === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>No session data yet.</p>
      ) : (
        <>
          {/* Session-quality stat tiles. auto-fit so they wrap cleanly on a
              phone rather than overflowing. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 12, marginBottom: 18 }}>
            <Stat label="Pages / session" value={e.pagesPerSession.toFixed(1)} />
            <Stat label="Avg session" value={fmtDuration(e.avgSessionSeconds)} />
            <Stat
              label="Bounce rate"
              value={`${Math.round(e.bounceRate * 100)}%`}
              sub={e.bounceRate >= 0.6 ? 'high' : e.bounceRate <= 0.4 ? 'healthy' : undefined}
              tone={e.bounceRate >= 0.6 ? '#ef4444' : e.bounceRate <= 0.4 ? '#10b981' : '#111827'}
            />
          </div>

          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Where visitors land
          </div>
          {entryPages.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.8125rem', margin: 0 }}>No entry-page data yet.</p>
          ) : (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {entryPages.map(row => {
                const pct = (row.sessions / maxEntry) * 100;
                return (
                  <li key={row.path} style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: '#fdf2f8', borderRadius: 6, zIndex: 0 }} />
                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', gap: 12 }}>
                      <span style={{ fontSize: '0.8125rem', color: '#111827', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }} title={row.path}>
                        {row.path}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, color: '#111827' }}>{row.sessions.toLocaleString()}</span>
                        <span style={{ color: '#9ca3af', marginLeft: 4 }}>sess.</span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone = '#111827' }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div style={{ background: '#fafafa', border: '1px solid #f3f4f6', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: tone, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.62rem', color: tone, marginTop: 1, textTransform: 'capitalize' }}>{sub}</div>}
    </div>
  );
}
