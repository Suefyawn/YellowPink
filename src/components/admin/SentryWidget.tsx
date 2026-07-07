import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';
import { AdminIcon } from '@/components/ui/AdminIcon';

interface SentryIssue {
  id: string;
  title: string;
  level: string;
  count: string;
  userCount?: number;
  firstSeen?: string | null;
  lastSeen: string;
  permalink: string;
}

interface SentryData {
  total: number;
  errors: number;
  warnings: number;
  issues: SentryIssue[];
  /** Top affected URLs aggregated from issue `url` tags (best-effort). */
  topRoutes?: { url: string; count: number }[];
  /** Daily error totals for the last 14 days (oldest first). */
  trend?: { date: string; count: number }[];
}

const levelColors: Record<string, string> = {
  fatal: '#dc2626', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6',
};

export async function SentryWidget() {
  const result = await readAnalyticsCache<SentryData>('sentry');

  const cardStyle = {
    background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '24px',
  };

  if (!result) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ color: '#C5286A', display: 'inline-flex' }}><AdminIcon name="bug" size={18} /></span>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Sentry error tracking</h2>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>No data yet, hit Refresh analytics.</p>
      </div>
    );
  }

  const { data: stats, updatedAt } = result;
  // Server component renders once per request, so Date.now() is stable here;
  // the purity rule targets client components the React Compiler may re-render.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#C5286A', display: 'inline-flex' }}><AdminIcon name="bug" size={18} /></span>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Sentry error tracking</h2>
        </div>
        <a
          href="https://trellee.sentry.io/projects/yellowpink/"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '0.8125rem', color: '#6366f1', textDecoration: 'none' }}
        >
          Open Sentry →
        </a>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: '0.75rem', color: '#9ca3af' }}>
        Unresolved issues · refreshed {timeAgoShort(updatedAt)}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total issues', value: stats.total, color: '#6366f1' },
          { label: 'Errors',       value: stats.errors, color: '#ef4444' },
          { label: 'Warnings',     value: stats.warnings, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{
            background: s.color + '10', borderRadius: 8, padding: '12px',
            textAlign: 'center', border: `1px solid ${s.color}22`,
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 14-day trend, only render when we have a meaningful shape. */}
      {stats.trend && stats.trend.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Errors per day · 14d
            </span>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              {stats.trend.reduce((s, d) => s + d.count, 0).toLocaleString()} total
            </span>
          </div>
          <TrendBars data={stats.trend} />
        </div>
      )}

      {/* Top affected routes */}
      {stats.topRoutes && stats.topRoutes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Top affected URLs
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {stats.topRoutes.slice(0, 5).map(r => (
              <li key={r.url} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.75rem' }}>
                <span
                  style={{ color: '#374151', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}
                  title={r.url}
                >
                  {r.url}
                </span>
                <span style={{ color: '#ef4444', fontWeight: 700, flexShrink: 0 }}>{r.count.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats.issues.length === 0 ? (
        <div style={{ padding: '12px', textAlign: 'center', color: '#10b981', fontSize: '0.875rem' }}>
          ✓ No unresolved issues
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Top issues by impact
          </div>
          {stats.issues.map(issue => {
            // "New today": first seen within the last 24h. Sentry sends ISO
            // timestamps; a missing value just means no badge.
            const isNew = issue.firstSeen
              ? (nowMs - new Date(issue.firstSeen).getTime()) < 24 * 60 * 60 * 1000
              : false;
            const users = Number(issue.userCount ?? 0);
            return (
            <a
              key={issue.id}
              href={issue.permalink}
              target="_blank" rel="noopener noreferrer"
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div style={{
                padding: '10px 12px', background: '#f9fafb', borderRadius: 8,
                border: '1px solid #f3f4f6', display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <span style={{
                  display: 'inline-block', padding: '1px 6px', borderRadius: 4,
                  fontSize: '0.6875rem', fontWeight: 700, flexShrink: 0, marginTop: 1,
                  background: (levelColors[issue.level] ?? '#6b7280') + '20',
                  color: levelColors[issue.level] ?? '#6b7280',
                  textTransform: 'uppercase',
                }}>
                  {issue.level}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isNew && (
                      <span style={{
                        flexShrink: 0, fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.04em',
                        color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca',
                        borderRadius: 4, padding: '0 4px', textTransform: 'uppercase',
                      }}>New</span>
                    )}
                    <div style={{
                      fontSize: '0.8125rem', color: '#111827', fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
                    }}>
                      {issue.title}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
                    {users > 0 && (
                      <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                        {users.toLocaleString()} {users === 1 ? 'person' : 'people'} affected
                      </span>
                    )}
                    {users > 0 && ' · '}
                    {Number(issue.count).toLocaleString()} occurrences · {timeAgoShort(issue.lastSeen)}
                  </div>
                </div>
              </div>
            </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Inline 14-bar trend chart. SVG, no JS, no client component, just a row
// of red bars scaled to the max value in the series.
function TrendBars({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const W = 240;
  const H = 40;
  const barW = W / data.length;
  return (
    <svg
      width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      role="img" aria-label={`Errors per day, last ${data.length} days`}
      style={{ display: 'block' }}
    >
      {data.map((d, i) => {
        const h = (d.count / max) * (H - 2);
        return (
          <rect
            key={d.date}
            x={i * barW + barW * 0.1}
            y={H - h}
            width={barW * 0.8}
            height={h || 1}
            fill={d.count === 0 ? '#e5e7eb' : '#ef4444'}
            rx={1}
          >
            <title>{d.date}: {d.count} errors</title>
          </rect>
        );
      })}
    </svg>
  );
}
