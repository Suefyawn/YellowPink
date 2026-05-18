import { createClient } from '@supabase/supabase-js';

interface SentryIssue {
  id: string;
  title: string;
  level: string;
  count: string;
  lastSeen: string;
  permalink: string;
}

interface SentryData {
  total: number;
  errors: number;
  warnings: number;
  issues: SentryIssue[];
}

async function fetchSentryData(): Promise<{ data: SentryData; updatedAt: string } | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data, error } = await supabase
      .from('analytics_cache')
      .select('data, updated_at')
      .eq('key', 'sentry')
      .single();
    if (error || !data) return null;
    return { data: data.data as SentryData, updatedAt: data.updated_at };
  } catch {
    return null;
  }
}

const levelColors: Record<string, string> = {
  fatal: '#dc2626', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6',
};

function timeAgoShort(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

export async function SentryWidget() {
  const result = await fetchSentryData();

  const cardStyle = {
    background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '24px',
  };

  if (!result) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: '1.1rem' }}>🐛</span>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Sentry Error Tracking</h2>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>No data yet. Ask Claude to refresh analytics.</p>
      </div>
    );
  }

  const { data: stats, updatedAt } = result;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
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

      <p style={{ margin: '0 0 16px', fontSize: '0.75rem', color: '#9ca3af' }}>
        Unresolved issues · refreshed {timeAgoShort(updatedAt)}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Issues', value: stats.total, color: '#6366f1' },
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

      {stats.issues.length === 0 ? (
        <div style={{ padding: '12px', textAlign: 'center', color: '#10b981', fontSize: '0.875rem' }}>
          ✓ No unresolved issues
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stats.issues.map(issue => (
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
                  <div style={{
                    fontSize: '0.8125rem', color: '#111827', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {issue.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
                    {Number(issue.count).toLocaleString()} occurrences · {timeAgoShort(issue.lastSeen)}
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
