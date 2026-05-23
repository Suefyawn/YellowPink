import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';
import { AdminIcon } from '@/components/ui/AdminIcon';

interface LandingRow {
  path: string;
  sessions: number;
  conversions: number;
  revenue: number;
  /** 0…1 fraction. */
  conversionRate: number;
}
interface Data { items: LandingRow[] }

const fmtPkr = (n: number) =>
  n >= 100_000 ? `PKR ${Math.round(n / 1000)}k` : `PKR ${Math.round(n).toLocaleString()}`;

// "What pages did organic Google visitors land on, and which of those
// converted?" — the GA4-unique view; PostHog can't see Google as a channel.
// Link GA4 ↔ Search Console in GA4 Admin → Product links to also see the
// search-query breakdown that drove these landings.
export async function GA4LandingsWidget() {
  const result = await readAnalyticsCache<Data>('ga4_landings');

  const cardStyle = {
    background: 'white',
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    padding: '24px',
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#C5286A', display: 'inline-flex' }}><AdminIcon name="document" size={16} /></span>
            Organic search landings (GA4)
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
            Last 7 days{result ? ` · refreshed ${timeAgoShort(result.updatedAt)}` : ''}
          </p>
        </div>
      </div>

      {!result || !result.data.items?.length ? (
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
          No organic-search landings yet — either GA4 isn&apos;t configured or
          no Google-search sessions in the last 7 days.
        </p>
      ) : (
        <Rows items={result.data.items} />
      )}
    </div>
  );
}

function Rows({ items }: { items: LandingRow[] }) {
  const max = Math.max(...items.map(i => i.sessions), 1);
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
          <th scope="col" style={th()}>Landing page</th>
          <th scope="col" style={{ ...th(), textAlign: 'right' }}>Sessions</th>
          <th scope="col" style={{ ...th(), textAlign: 'right' }}>CR</th>
          <th scope="col" style={{ ...th(), textAlign: 'right' }}>Revenue</th>
        </tr>
      </thead>
      <tbody>
        {items.map(row => {
          const pct = (row.sessions / max) * 100;
          const crPct = (row.conversionRate * 100).toFixed(1);
          return (
            <tr key={row.path} style={{ borderBottom: '1px solid #f3f4f6', position: 'relative' }}>
              <td style={{ ...td(), fontFamily: 'monospace', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: 'relative' }}>
                <span
                  aria-hidden
                  style={{
                    position: 'absolute', inset: 0, width: `${pct}%`,
                    background: '#fdf2f8', borderRadius: 4, zIndex: 0,
                  }}
                />
                <span style={{ position: 'relative', zIndex: 1 }} title={row.path}>{row.path}</span>
              </td>
              <td style={{ ...td(), textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: '#111827' }}>
                {row.sessions.toLocaleString()}
              </td>
              <td style={{ ...td(), textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: row.conversionRate > 0.02 ? '#10b981' : '#6b7280' }}>
                {crPct}%
              </td>
              <td style={{ ...td(), textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>
                {row.revenue > 0 ? fmtPkr(row.revenue) : '—'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function th(): React.CSSProperties {
  return { padding: '6px 0', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em' };
}
function td(): React.CSSProperties {
  return { padding: '8px 0', color: '#111827' };
}
