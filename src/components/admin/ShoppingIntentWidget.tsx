import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';
import { AdminIcon } from '@/components/ui/AdminIcon';

// "What shoppers want" — two demand signals from the rolling 7-day PostHog
// snapshot that were previously invisible in the admin:
//   • Top on-site search terms — direct demand + catalogue-gap signal.
//   • Most-viewed products with view→cart conversion — a product with lots of
//     views but few carts is a pricing / photo / copy problem to act on.

interface SearchTerm { term: string; count: number; uniques: number; }
interface ProductIntent { product: string; views: number; carts: number; }
interface Data { searchTerms: SearchTerm[]; productIntent: ProductIntent[]; }

const cardStyle = {
  background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '24px',
};

export async function ShoppingIntentWidget() {
  const result = await readAnalyticsCache<Data>('posthog_intent');
  const searchTerms = result?.data.searchTerms ?? [];
  const products = result?.data.productIntent ?? [];
  const maxSearch = Math.max(...searchTerms.map(s => s.count), 1);

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#C5286A', display: 'inline-flex' }}><AdminIcon name="search" size={16} /></span>
            What shoppers want
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
            Searches &amp; product interest, last 7 days{result ? ` · refreshed ${timeAgoShort(result.updatedAt)}` : ''}
          </p>
        </div>
      </div>

      {searchTerms.length === 0 && products.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>No search or product-view data yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 24 }} className="adm-analytics-grid">
          {/* Top searches */}
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Top searches</div>
            {searchTerms.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.8125rem', margin: 0 }}>No searches yet.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {searchTerms.map(s => {
                  const barPct = (s.count / maxSearch) * 100;
                  return (
                    <li key={s.term} style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', inset: 0, width: `${barPct}%`, background: '#eef2ff', borderRadius: 6, zIndex: 0 }} />
                      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', gap: 8 }}>
                        <span style={{ fontSize: '0.8125rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }} title={s.term}>
                          {s.term}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827', flexShrink: 0 }}>{s.count.toLocaleString()}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Most-viewed products + view→cart conversion */}
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Most-viewed products · view → cart</div>
            {products.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.8125rem', margin: 0 }}>No product-view data yet.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {products.map(p => {
                  const conv = p.views > 0 ? Math.round((p.carts / p.views) * 100) : 0;
                  // A product with real view volume but no carts is the actionable
                  // case — flag it amber so it stands out from healthy converters.
                  const flag = p.views >= 10 && conv === 0;
                  const convColor = flag ? '#b45309' : conv >= 25 ? '#15803d' : conv >= 10 ? '#6b7280' : '#9ca3af';
                  return (
                    <li key={p.product} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: '0.8125rem' }}>
                      <span style={{ color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }} title={p.product}>
                        {p.product}
                      </span>
                      <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{p.views.toLocaleString()}<span style={{ color: '#9ca3af' }}>v</span></span>
                        <span style={{ fontWeight: 700, color: convColor, fontVariantNumeric: 'tabular-nums', minWidth: 34, textAlign: 'right' }}>
                          {conv}%{flag ? ' ⚠' : ''}
                        </span>
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
