import { getGoogleConnection, gscQuery, type GscRow } from '@/lib/google';

// Live Google Search Console performance (last 28 days) for the connected
// property. Renders nothing when Google isn't connected. Best-effort: a Google
// API hiccup shows an inline note, never breaks the Analytics page.

const card: React.CSSProperties = { background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' };
const fmt = (d: Date) => d.toISOString().slice(0, 10);

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, minWidth: 84 }}>
      <div style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
    </div>
  );
}

export async function SearchConsoleWidget({ days = 28 }: { days?: number } = {}) {
  const conn = await getGoogleConnection();
  if (!conn?.gsc_site_url) return null;

  const today = new Date();
  const start = fmt(new Date(today.getTime() - Math.max(1, days) * 86_400_000));
  const end = fmt(today);

  let totals: GscRow | undefined;
  let queries: GscRow[] = [];
  let failed = false;
  try {
    const [t, q] = await Promise.all([
      gscQuery({ siteUrl: conn.gsc_site_url, startDate: start, endDate: end, dimensions: [], rowLimit: 1 }),
      gscQuery({ siteUrl: conn.gsc_site_url, startDate: start, endDate: end, dimensions: ['query'], rowLimit: 8 }),
    ]);
    totals = t[0];
    queries = q;
  } catch { failed = true; }

  return (
    <div style={card}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Search Console · last {days} days</h2>
        <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', color: '#C5286A', textDecoration: 'none' }}>Open →</a>
      </div>
      {failed ? (
        <div style={{ padding: '28px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          Couldn’t load Search Console data. Re-connect Google in Settings → Integrations if this persists.
        </div>
      ) : (
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
            <Stat label="Clicks" value={(totals?.clicks ?? 0).toLocaleString()} />
            <Stat label="Impressions" value={(totals?.impressions ?? 0).toLocaleString()} />
            <Stat label="CTR" value={`${((totals?.ctr ?? 0) * 100).toFixed(1)}%`} />
            <Stat label="Avg position" value={(totals?.position ?? 0).toFixed(1)} />
          </div>
          {queries.length > 0 && (
            <>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Top queries</div>
              <div className="adm-table-scroll"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ color: '#9ca3af', textAlign: 'right' }}>
                    <th style={{ textAlign: 'left', fontWeight: 600, padding: '2px 0' }}>Query</th>
                    <th style={{ fontWeight: 600 }}>Clicks</th>
                    <th style={{ fontWeight: 600 }}>Impr.</th>
                    <th style={{ fontWeight: 600 }}>Pos.</th>
                  </tr>
                </thead>
                <tbody>
                  {queries.map(r => (
                    <tr key={r.keys[0]} style={{ color: '#374151' }}>
                      <td style={{ padding: '4px 0', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.keys[0]}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.clicks}</td>
                      <td style={{ textAlign: 'right', color: '#6b7280' }}>{r.impressions.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', color: '#6b7280' }}>{r.position.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
