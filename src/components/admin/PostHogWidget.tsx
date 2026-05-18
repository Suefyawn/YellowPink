interface PHTrend {
  date: string;
  count: number;
}

interface PHStats {
  pageviews: number;
  uniqueUsers: number;
  sessions: number;
  trend: PHTrend[];
}

async function fetchPHStats(): Promise<PHStats | null> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = '429225';
  if (!apiKey) return null;

  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  const host = 'https://us.i.posthog.com';

  try {
    const [pvRes, uuRes, sessionRes] = await Promise.all([
      // Pageviews last 7 days
      fetch(`${host}/api/projects/${projectId}/query/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: {
            kind: 'TrendsQuery',
            series: [{ kind: 'EventsNode', event: '$pageview', math: 'total' }],
            dateRange: { date_from: '-7d' },
            interval: 'day',
          },
        }),
        next: { revalidate: 300 },
      }),
      // Unique users last 7 days
      fetch(`${host}/api/projects/${projectId}/query/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: {
            kind: 'TrendsQuery',
            series: [{ kind: 'EventsNode', event: '$pageview', math: 'dau' }],
            dateRange: { date_from: '-7d' },
            interval: 'week',
          },
        }),
        next: { revalidate: 300 },
      }),
      // Sessions last 7 days
      fetch(`${host}/api/projects/${projectId}/query/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: {
            kind: 'TrendsQuery',
            series: [{ kind: 'EventsNode', event: '$pageview', math: 'unique_session' }],
            dateRange: { date_from: '-7d' },
            interval: 'week',
          },
        }),
        next: { revalidate: 300 },
      }),
    ]);

    if (!pvRes.ok) return null;

    const pvData = await pvRes.json() as {
      results: Array<{ data: number[]; labels: string[] }>;
    };

    const series = pvData.results?.[0];
    const trend: PHTrend[] = (series?.labels ?? []).map((date, i) => ({
      date,
      count: series?.data?.[i] ?? 0,
    }));
    const pageviews = trend.reduce((s, d) => s + d.count, 0);

    let uniqueUsers = 0;
    if (uuRes.ok) {
      const uuData = await uuRes.json() as { results: Array<{ data: number[] }> };
      uniqueUsers = uuData.results?.[0]?.data?.reduce((s: number, n: number) => s + n, 0) ?? 0;
    }

    let sessions = 0;
    if (sessionRes.ok) {
      const sData = await sessionRes.json() as { results: Array<{ data: number[] }> };
      sessions = sData.results?.[0]?.data?.reduce((s: number, n: number) => s + n, 0) ?? 0;
    }

    return { pageviews, uniqueUsers, sessions, trend };
  } catch {
    return null;
  }
}

function MiniSparkline({ trend }: { trend: PHTrend[] }) {
  if (trend.length === 0) return null;
  const max = Math.max(...trend.map(d => d.count), 1);
  const w = 160;
  const h = 36;
  const pts = trend.map((d, i) => {
    const x = (i / Math.max(trend.length - 1, 1)) * w;
    const y = h - (d.count / max) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke="#ec4899" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export async function PostHogWidget() {
  const stats = await fetchPHStats();

  const cardStyle = {
    background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '24px',
  };

  if (!process.env.POSTHOG_PERSONAL_API_KEY) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: '1.1rem' }}>📊</span>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>PostHog Analytics</h2>
        </div>
        <div style={{
          padding: '20px', background: '#fdf2f8', borderRadius: 8, border: '1px solid #f9a8d4',
          textAlign: 'center',
        }}>
          <p style={{ margin: '0 0 8px', color: '#9d174d', fontWeight: 600, fontSize: '0.875rem' }}>
            Personal API key not configured
          </p>
          <p style={{ margin: 0, color: '#be185d', fontSize: '0.8125rem' }}>
            Add <code style={{ background: '#fce7f3', padding: '1px 4px', borderRadius: 3 }}>POSTHOG_PERSONAL_API_KEY</code> to your Vercel env vars to enable this widget.
          </p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: '1.1rem' }}>📊</span>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>PostHog Analytics</h2>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>Failed to load analytics data.</p>
      </div>
    );
  }

  const statItems = [
    { label: 'Page Views', value: stats.pageviews, color: '#ec4899' },
    { label: 'Unique Users', value: stats.uniqueUsers, color: '#8b5cf6' },
    { label: 'Sessions', value: stats.sessions, color: '#3b82f6' },
  ];

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.1rem' }}>📊</span>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>PostHog Analytics</h2>
        </div>
        <a
          href="https://us.posthog.com/project/429225"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '0.8125rem', color: '#ec4899', textDecoration: 'none' }}
        >
          Open PostHog →
        </a>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: '0.75rem', color: '#9ca3af' }}>Last 7 days</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {statItems.map(s => (
          <div key={s.label} style={{
            background: s.color + '10', borderRadius: 8, padding: '12px',
            textAlign: 'center', border: `1px solid ${s.color}22`,
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>
              {s.value.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sparkline */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Daily pageviews</span>
        <MiniSparkline trend={stats.trend} />
      </div>
    </div>
  );
}
