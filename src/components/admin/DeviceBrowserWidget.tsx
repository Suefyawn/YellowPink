import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';
import { AdminIcon } from '@/components/ui/AdminIcon';

// "Who's browsing, on what" — visitor share by device type and by browser,
// from the rolling 7-day PostHog snapshot (populated by refreshAnalytics()).
// The device split frames every funnel reading (this store is phone-first);
// the browser split surfaces in-app webviews (Instagram / Facebook / WhatsApp)
// that behave differently at checkout.

interface Row { label: string; visitors: number; }
interface Data { devices: Row[]; browsers: Row[]; }

const cardStyle = {
  background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '24px',
};

export async function DeviceBrowserWidget() {
  const result = await readAnalyticsCache<Data>('posthog_devices');
  const devices = result?.data.devices ?? [];
  const browsers = result?.data.browsers ?? [];

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#C5286A', display: 'inline-flex' }}><AdminIcon name="users" size={16} /></span>
            Device &amp; browser
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
            Visitors, last 7 days{result ? ` · refreshed ${timeAgoShort(result.updatedAt)}` : ''}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="adm-analytics-grid">
        <Column heading="Device" items={devices} empty="No device data yet." accent="#6366f1" />
        <Column heading="Browser" items={browsers} empty="No browser data yet." accent="#0ea5e9" />
      </div>
    </div>
  );
}

function Column({ heading, items, empty, accent }: { heading: string; items: Row[]; empty: string; accent: string }) {
  const total = items.reduce((s, i) => s + i.visitors, 0);
  const max = Math.max(...items.map(i => i.visitors), 1);
  return (
    <div>
      <div style={{
        fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
      }}>{heading}</div>
      {items.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: '0.8125rem', margin: 0 }}>{empty}</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map(item => {
            const barPct = (item.visitors / max) * 100;
            const sharePct = total > 0 ? Math.round((item.visitors / total) * 100) : 0;
            return (
              <li key={item.label} style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', inset: 0, width: `${barPct}%`,
                  background: `${accent}15`, borderRadius: 6, zIndex: 0,
                }} />
                <div style={{
                  position: 'relative', zIndex: 1,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 10px', gap: 8,
                }}>
                  <span style={{
                    fontSize: '0.8125rem', color: '#111827', textTransform: 'capitalize',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flex: 1, minWidth: 0,
                  }} title={item.label}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: '0.75rem', flexShrink: 0 }}>
                    <span style={{ fontWeight: 700, color: '#111827' }}>{sharePct}%</span>
                    <span style={{ color: '#9ca3af', marginLeft: 6 }}>{item.visitors.toLocaleString()}</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
