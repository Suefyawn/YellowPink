import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';

interface Row {
  device: string;
  visit: number; product: number; cart: number; checkout: number; purchase: number;
}
interface Data { items: Row[] }

// Clamp at 100%: a lightweight event-count proxy can out-count an earlier step,
// but a funnel step can't convert >100% of the prior one.
const pct = (num: number, denom: number) => denom > 0 ? `${Math.min(100, Math.round((num / denom) * 100))}%` : '—';

export async function FunnelByDeviceWidget() {
  const result = await readAnalyticsCache<Data>('posthog_funnel_by_device');

  const cardStyle = {
    background: 'white', borderRadius: 10, padding: '20px 22px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  } as const;

  if (!result || result.data.items.length === 0) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', marginBottom: 4 }}>
          Funnel by device
        </div>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9ca3af' }}>
          No device data yet, refresh analytics to populate.
        </p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          Funnel by device
        </h3>
        <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
          7-day · {timeAgoShort(result.updatedAt)}
        </span>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5 }}>
        Conversion rate at each step, split by device. A big gap at the
        Product&nbsp;→&nbsp;Cart step on one device points to layout friction there.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: 480 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <th scope="col" style={{ padding: '6px 8px', textAlign: 'left',  color: '#6b7280', fontWeight: 600 }}>Device</th>
              <th scope="col" style={{ padding: '6px 8px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>Visits</th>
              <th scope="col" style={{ padding: '6px 8px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>→ Product</th>
              <th scope="col" style={{ padding: '6px 8px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>→ Cart</th>
              <th scope="col" style={{ padding: '6px 8px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>→ Checkout</th>
              <th scope="col" style={{ padding: '6px 8px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>→ Purchase</th>
              <th scope="col" style={{ padding: '6px 8px', textAlign: 'right', color: '#111827', fontWeight: 700 }}>Conv.</th>
            </tr>
          </thead>
          <tbody>
            {result.data.items.map(r => (
              <tr key={r.device} style={{ borderTop: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>{r.device}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{r.visit.toLocaleString()}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{pct(r.product, r.visit)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{pct(r.cart, r.product)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{pct(r.checkout, r.cart)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{pct(r.purchase, r.checkout)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: '#C5286A', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{pct(r.purchase, r.visit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
