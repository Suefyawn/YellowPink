import Link from 'next/link';

interface SentryIssue {
  id: string;
  title: string;
  level: string;
  count: string;
  lastSeen: string;
  permalink: string;
}

async function fetchSentryIssues(): Promise<SentryIssue[] | null> {
  const token = process.env.SENTRY_AUTH_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(
      'https://us.sentry.io/api/0/projects/trellee/yellowpink/issues/?limit=5&query=is:unresolved&sort=date',
      {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as Array<{
      id: string; title: string; level: string;
      count: string; lastSeen: string; permalink: string;
    }>;
    return data.slice(0, 5).map(i => ({
      id: i.id, title: i.title, level: i.level,
      count: i.count, lastSeen: i.lastSeen, permalink: i.permalink,
    }));
  } catch {
    return null;
  }
}

async function fetchSentryStats(): Promise<{ total: number; errors: number; warnings: number } | null> {
  const token = process.env.SENTRY_AUTH_TOKEN;
  if (!token) return null;

  try {
    const since = Math.floor(Date.now() / 1000) - 86400;
    const res = await fetch(
      `https://us.sentry.io/api/0/projects/trellee/yellowpink/issues/?limit=100&query=is:unresolved&since=${since}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as Array<{ level: string }>;
    return {
      total: data.length,
      errors: data.filter(i => i.level === 'error' || i.level === 'fatal').length,
      warnings: data.filter(i => i.level === 'warning').length,
    };
  } catch {
    return null;
  }
}

const levelColors: Record<string, string> = {
  fatal: '#dc2626', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6',
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export async function SentryWidget() {
  const [issues, stats] = await Promise.all([fetchSentryIssues(), fetchSentryStats()]);

  const cardStyle = {
    background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '24px',
  };

  if (!process.env.SENTRY_AUTH_TOKEN) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: '1.1rem' }}>🐛</span>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Sentry Error Tracking</h2>
        </div>
        <div style={{
          padding: '20px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca',
          textAlign: 'center',
        }}>
          <p style={{ margin: '0 0 8px', color: '#991b1b', fontWeight: 600, fontSize: '0.875rem' }}>
            Auth token not configured
          </p>
          <p style={{ margin: 0, color: '#dc2626', fontSize: '0.8125rem' }}>
            Add <code style={{ background: '#fee2e2', padding: '1px 4px', borderRadius: 3 }}>SENTRY_AUTH_TOKEN</code> to your Vercel env vars to enable this widget.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.1rem' }}>🐛</span>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Sentry Error Tracking</h2>
        </div>
        <a
          href="https://trellee.sentry.io/projects/yellowpink/"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '0.8125rem', color: '#6366f1', textDecoration: 'none' }}
        >
          Open Sentry →
        </a>
      </div>

      {/* 24h stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Unresolved (24h)', value: stats.total, color: '#6366f1' },
            { label: 'Errors', value: stats.errors, color: '#ef4444' },
            { label: 'Warnings', value: stats.warnings, color: '#f59e0b' },
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
      )}

      {/* Recent issues */}
      {!issues || issues.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', color: '#10b981', fontSize: '0.875rem' }}>
          ✓ No unresolved issues
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {issues.map(issue => (
            <a
              key={issue.id}
              href={issue.permalink}
              target="_blank" rel="noopener noreferrer"
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div style={{
                padding: '10px 12px', background: '#f9fafb', borderRadius: 8,
                border: '1px solid #f3f4f6', cursor: 'pointer',
                display: 'flex', alignItems: 'flex-start', gap: 10,
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
                  <div style={{
                    fontSize: '0.8125rem', color: '#111827', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {issue.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
                    {Number(issue.count).toLocaleString()} occurrences · {timeAgo(issue.lastSeen)}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
