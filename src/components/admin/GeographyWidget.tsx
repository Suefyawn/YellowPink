import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';
import { AdminIcon } from '@/components/ui/AdminIcon';

// "Where visitors are" — GeoIP city + country breakdown from the rolling 7-day
// PostHog snapshot. For a Pakistan-first, COD storefront this answers two live
// questions: which cities to prioritise for delivery/ads, and how much traffic
// is international (won't convert to COD). Empty when GeoIP is off in PostHog.

interface City { city: string; region: string; visitors: number; }
interface Country { country: string; code: string; visitors: number; }
interface Data { cities: City[]; countries: Country[]; }

const cardStyle = {
  background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '24px',
};

export async function GeographyWidget() {
  const result = await readAnalyticsCache<Data>('posthog_geography');
  const cities = result?.data.cities ?? [];
  const countries = result?.data.countries ?? [];
  const maxCity = Math.max(...cities.map(c => c.visitors), 1);
  const countryTotal = countries.reduce((s, c) => s + c.visitors, 0);

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#C5286A', display: 'inline-flex' }}><AdminIcon name="target" size={16} /></span>
            Where visitors are
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
            Visitors, last 7 days{result ? ` · refreshed ${timeAgoShort(result.updatedAt)}` : ''}
          </p>
        </div>
      </div>

      {cities.length === 0 && countries.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
          No location data yet. (Enable GeoIP enrichment in PostHog if this stays empty.)
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24 }} className="adm-analytics-grid">
          {/* Cities */}
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Top cities</div>
            {cities.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.8125rem', margin: 0 }}>No city data yet.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cities.map(c => {
                  const barPct = (c.visitors / maxCity) * 100;
                  return (
                    <li key={`${c.city}-${c.region}`} style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', inset: 0, width: `${barPct}%`, background: '#fdf2f8', borderRadius: 6, zIndex: 0 }} />
                      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', gap: 8 }}>
                        <span style={{ fontSize: '0.8125rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }} title={c.region ? `${c.city}, ${c.region}` : c.city}>
                          {c.city}{c.region ? <span style={{ color: '#9ca3af' }}> · {c.region}</span> : null}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827', flexShrink: 0 }}>{c.visitors.toLocaleString()}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Countries */}
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>By country</div>
            {countries.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.8125rem', margin: 0 }}>No country data yet.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {countries.map(c => {
                  const sharePct = countryTotal > 0 ? Math.round((c.visitors / countryTotal) * 100) : 0;
                  return (
                    <li key={c.country} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: '0.8125rem', padding: '3px 0' }}>
                      <span style={{ color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }} title={c.country}>
                        {c.country}
                      </span>
                      <span style={{ flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, color: '#111827' }}>{sharePct}%</span>
                        <span style={{ color: '#9ca3af', marginLeft: 6 }}>{c.visitors.toLocaleString()}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
