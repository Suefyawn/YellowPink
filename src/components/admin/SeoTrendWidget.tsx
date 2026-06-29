import { supabaseAdmin } from '@/lib/supabase';

// SEO trend, in-app. Reads the daily GSC + GA4 series the analytics-refresh cron
// persists (seo_daily_metrics) so the owner can see whether organic
// clicks/impressions/position + sessions + indexation are actually improving
// over time — the answer to "is the SEO work paying off?". Empty until the
// nightly refresh has run at least once with Google connected.

interface Row {
  day: string;
  gsc_clicks: number | null;
  gsc_impressions: number | null;
  gsc_ctr: number | null;
  gsc_position: number | null;
  ga4_sessions: number | null;
  ga4_organic_sessions: number | null;
  ga4_users: number | null;
  sitemap_submitted: number | null;
}

const card: React.CSSProperties = { background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' };
const GSC_URL = 'https://search.google.com/search-console?resource_id=sc-domain:yellowpink.pk';

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 92 }}>
      <div style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

export async function SeoTrendWidget({ days = 90 }: { days?: number }) {
  let rows: Row[] = [];
  try {
    const { data } = await supabaseAdmin().rpc('seo_metrics_trend' as never, { p_days: days } as never);
    rows = (data ?? []) as Row[];
  } catch { rows = []; }

  if (rows.length === 0) {
    return (
      <div style={card}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6' }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>SEO trend · Search Console + GA4</h2>
        </div>
        <div style={{ padding: '28px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          Collecting — the first data point lands after tonight&apos;s analytics
          refresh (needs Google still connected in Settings → Integrations).
        </div>
      </div>
    );
  }

  // Totals over the window (GSC lags ~2-3 days, so trailing days may be sparse).
  const sum = (k: keyof Row) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const clicks = sum('gsc_clicks');
  const impressions = sum('gsc_impressions');
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const withPos = rows.filter(r => r.gsc_position != null);
  const avgPos = withPos.length ? withPos.reduce((s, r) => s + (r.gsc_position ?? 0), 0) / withPos.length : null;
  const organic = sum('ga4_organic_sessions');
  const sessions = sum('ga4_sessions');
  // Latest non-null sitemap count = indexation proxy.
  const sitemap = [...rows].reverse().find(r => r.sitemap_submitted != null)?.sitemap_submitted ?? null;

  const maxImp = Math.max(1, ...rows.map(r => Number(r.gsc_impressions) || 0));

  return (
    <div style={card}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          SEO trend · last {days} days
          <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '0.8125rem' }}> · Search Console + GA4</span>
        </h2>
        <a href={GSC_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', color: '#C5286A', textDecoration: 'none' }}>Open Search Console →</a>
      </div>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
          <Stat label="Organic clicks" value={clicks.toLocaleString()} sub="Google search" />
          <Stat label="Impressions" value={impressions.toLocaleString()} />
          <Stat label="CTR" value={`${ctr.toFixed(1)}%`} />
          <Stat label="Avg position" value={avgPos != null ? avgPos.toFixed(1) : '—'} sub="lower = better" />
          <Stat label="Organic sessions" value={organic.toLocaleString()} sub={`of ${sessions.toLocaleString()} total`} />
          <Stat label="Pages submitted" value={sitemap != null ? sitemap.toLocaleString() : '—'} sub="sitemap → Google" />
        </div>

        {/* Impressions sparkline — the leading indicator that Google is showing
            more of the site as the SEO work compounds. */}
        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Impressions / day
        </div>
        <svg width="100%" height="44" viewBox={`0 0 ${Math.max(rows.length, 1) * 6} 44`} preserveAspectRatio="none" role="img" aria-label="Impressions per day" style={{ display: 'block' }}>
          {rows.map((r, i) => {
            const v = Number(r.gsc_impressions) || 0;
            const h = (v / maxImp) * 42;
            return <rect key={r.day} x={i * 6 + 0.5} y={44 - h} width={5} height={h || 0.5} fill={v === 0 ? '#e5e7eb' : '#C5286A'} rx={1}><title>{r.day}: {v} impressions</title></rect>;
          })}
        </svg>
        {clicks === 0 && impressions === 0 && (
          <p style={{ margin: '12px 0 0', fontSize: '0.7rem', color: '#9ca3af' }}>
            No Search Console impressions yet in this window — expected while
            rankings sit below page 1. This widget will show the climb as the
            site earns visibility.
          </p>
        )}
      </div>
    </div>
  );
}
