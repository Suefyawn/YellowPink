import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';
import { AdminIcon } from '@/components/ui/AdminIcon';

interface ChannelRow {
  channel: string;
  sessions: number;
  engagedSessions: number;
  conversions: number;
}
interface Data { items: ChannelRow[] }

// "Where did the traffic come from?" — GA4's session-default-channel grouping.
// Complements PostHog's referrer list because GA4 has Google's own attribution
// model (it knows Organic Search is search, not "google.com referral", etc.).
export async function GA4ChannelsWidget() {
  const result = await readAnalyticsCache<Data>('ga4_channels');

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
            <span style={{ color: '#C5286A', display: 'inline-flex' }}><AdminIcon name="bar-chart" size={16} /></span>
            Traffic by channel (GA4)
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
            Last 7 days{result ? ` · refreshed ${timeAgoShort(result.updatedAt)}` : ''}
          </p>
        </div>
      </div>

      {!result || !result.data.items?.length ? (
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
          No GA4 data yet. Set GA4_PROPERTY_ID + GA4_SERVICE_ACCOUNT_JSON, then Refresh.
        </p>
      ) : (
        <ChannelRows items={result.data.items} />
      )}
    </div>
  );
}

function ChannelRows({ items }: { items: ChannelRow[] }) {
  const max = Math.max(...items.map(i => i.sessions), 1);
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(row => {
        const pct = (row.sessions / max) * 100;
        const engagedPct = row.sessions > 0 ? Math.round((row.engagedSessions / row.sessions) * 100) : 0;
        return (
          <li key={row.channel} style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: 0, width: `${pct}%`,
              background: '#fdf2f8', borderRadius: 6, zIndex: 0,
            }} />
            <div style={{
              position: 'relative', zIndex: 1,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 10px', gap: 12,
            }}>
              <span style={{ fontSize: '0.8125rem', color: '#111827', flex: 1, minWidth: 0, fontWeight: 600 }}>
                {row.channel}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#6b7280', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ fontWeight: 700, color: '#111827' }}>{row.sessions.toLocaleString()}</span>
                <span style={{ color: '#9ca3af', marginLeft: 6 }}>· {engagedPct}% engaged</span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
