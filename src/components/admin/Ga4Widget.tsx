import { getGoogleConnection, ga4RunReport } from '@/lib/google';

// Live GA4 metrics (last 28 days) for the connected property. Renders nothing
// when Google/GA4 isn't connected. Best-effort, never breaks the page.

const card: React.CSSProperties = { background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, minWidth: 84 }}>
      <div style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
    </div>
  );
}

export async function Ga4Widget() {
  const conn = await getGoogleConnection();
  if (!conn?.ga4_property_id) return null;

  let sessions = 0, users = 0, views = 0, orders = 0, revenue = 0;
  let channels: { name: string; sessions: number }[] = [];
  let failed = false;
  try {
    const [totals, byChannel] = await Promise.all([
      ga4RunReport({ propertyId: conn.ga4_property_id, startDate: '28daysAgo', endDate: 'today', metrics: ['sessions', 'totalUsers', 'screenPageViews', 'transactions', 'purchaseRevenue'] }),
      ga4RunReport({ propertyId: conn.ga4_property_id, startDate: '28daysAgo', endDate: 'today', dimensions: ['sessionDefaultChannelGroup'], metrics: ['sessions'], limit: 6 }),
    ]);
    const m = totals[0]?.metrics ?? [];
    sessions = m[0] ?? 0; users = m[1] ?? 0; views = m[2] ?? 0; orders = m[3] ?? 0; revenue = m[4] ?? 0;
    channels = byChannel.map(r => ({ name: r.dimensions[0] || '(other)', sessions: r.metrics[0] ?? 0 }))
      .sort((a, b) => b.sessions - a.sessions);
  } catch { failed = true; }

  const maxCh = Math.max(1, ...channels.map(c => c.sessions));

  return (
    <div style={card}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          Google Analytics · last 28 days
          {conn.ga4_property_name && <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '0.8125rem' }}> · {conn.ga4_property_name}</span>}
        </h2>
        <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', color: '#C5286A', textDecoration: 'none' }}>Open →</a>
      </div>
      {failed ? (
        <div style={{ padding: '28px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          Couldn’t load GA4 data. Check the linked property in Settings → Integrations.
        </div>
      ) : (
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
            <Stat label="Sessions" value={sessions.toLocaleString()} />
            <Stat label="Users" value={users.toLocaleString()} />
            <Stat label="Pageviews" value={views.toLocaleString()} />
            <Stat label="Orders" value={orders.toLocaleString()} />
            <Stat label="Revenue" value={`Rs ${Math.round(revenue).toLocaleString()}`} />
          </div>
          {orders === 0 && revenue === 0 && (
            <p style={{ margin: '-8px 0 14px', fontSize: '0.7rem', color: '#9ca3af' }}>
              Orders/Revenue read 0, GA4 ecommerce (purchase) events aren’t being received yet.
            </p>
          )}
          {channels.length > 0 && (
            <>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Sessions by channel</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {channels.map(c => (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ flex: '0 0 110px', fontSize: '0.8125rem', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${(c.sessions / maxCh) * 100}%`, background: '#C5286A' }} />
                    </span>
                    <span style={{ flex: '0 0 auto', fontSize: '0.8125rem', fontWeight: 600, color: '#111827' }}>{c.sessions.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
