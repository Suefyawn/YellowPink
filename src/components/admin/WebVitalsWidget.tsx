import { supabaseAdmin } from '@/lib/supabase';

// Real Core Web Vitals, in-app. The storefront beacons every CWV sample to
// /api/vitals (consent-gated); this widget reads the p75 + good/ni/poor split
// from web_vitals_summary and assesses each p75 against Google's thresholds —
// the same field-data view Vercel Speed Insights shows, but without leaving the
// admin. A deep-link to Vercel is kept for the full per-page/percentile drill.
//
// Respects the Analytics page's day-range pills via the `days` prop.

interface SummaryRow {
  metric: string;
  p75: number;
  samples: number;
  good: number;
  needs_improvement: number;
  poor: number;
}

type Rating = 'good' | 'needs-improvement' | 'poor';

// Google's Core Web Vitals thresholds (good ≤, poor >). Values in ms except CLS
// (unitless). p75 is rated against these.
const THRESHOLDS: Record<string, { good: number; poor: number; unit: 'ms' | 's' | 'cls' }> = {
  LCP:  { good: 2500, poor: 4000, unit: 's' },
  INP:  { good: 200,  poor: 500,  unit: 'ms' },
  CLS:  { good: 0.1,  poor: 0.25, unit: 'cls' },
  FCP:  { good: 1800, poor: 3000, unit: 's' },
  TTFB: { good: 800,  poor: 1800, unit: 'ms' },
};

// Order shown: the three Core Web Vitals first (what Google ranks on), then the
// two diagnostics.
const METRIC_ORDER = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

const RATING_COLOR: Record<Rating, string> = {
  good: '#10b981',
  'needs-improvement': '#f59e0b',
  poor: '#ef4444',
};

function rate(metric: string, p75: number): Rating {
  const t = THRESHOLDS[metric];
  if (!t) return 'needs-improvement';
  if (p75 <= t.good) return 'good';
  if (p75 > t.poor) return 'poor';
  return 'needs-improvement';
}

function fmtValue(metric: string, p75: number): string {
  const unit = THRESHOLDS[metric]?.unit;
  if (unit === 'cls') return p75.toFixed(2);
  if (unit === 's') return `${(p75 / 1000).toFixed(2)}s`;
  return `${Math.round(p75)}ms`;
}

const card: React.CSSProperties = { background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' };

// Vercel Speed Insights for this project — the full drill-down (per-route,
// per-percentile, device split) that we don't reproduce in-app.
const VERCEL_SPEED_INSIGHTS_URL = 'https://vercel.com/sufyan-s-projects-6dac35c9/yellow-pink/speed-insights';

export async function WebVitalsWidget({ days = 30 }: { days?: number }) {
  let rows: SummaryRow[] = [];
  try {
    const { data } = await supabaseAdmin().rpc('web_vitals_summary' as never, { p_days: days } as never);
    rows = (data ?? []) as SummaryRow[];
  } catch {
    rows = [];
  }

  const byMetric = new Map(rows.map(r => [r.metric, r]));
  const totalSamples = rows.reduce((s, r) => s + Number(r.samples), 0);

  return (
    <div style={card}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          Core Web Vitals · last {days} days
          <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '0.8125rem' }}> · field p75</span>
        </h2>
        <a href={VERCEL_SPEED_INSIGHTS_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', color: '#C5286A', textDecoration: 'none' }}>
          Open Speed Insights →
        </a>
      </div>

      {totalSamples === 0 ? (
        <div style={{ padding: '28px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          No Web Vitals collected yet in this window. Samples arrive from real
          visits once consent is given, give it a little traffic.
        </div>
      ) : (
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14, marginBottom: 16 }}>
            {METRIC_ORDER.filter(m => byMetric.has(m)).map(m => {
              const r = byMetric.get(m)!;
              const rating = rate(m, Number(r.p75));
              const color = RATING_COLOR[rating];
              const isCore = m === 'LCP' || m === 'INP' || m === 'CLS';
              return (
                <div key={m} style={{ background: color + '10', border: `1px solid ${color}22`, borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', letterSpacing: '0.04em' }}>{m}</span>
                    {isCore && <span title="Core Web Vital" style={{ fontSize: '0.6rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>core</span>}
                  </div>
                  <div style={{ fontSize: '1.375rem', fontWeight: 700, color, lineHeight: 1.15, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtValue(m, Number(r.p75))}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: 2, textTransform: 'capitalize' }}>
                    {rating.replace('-', ' ')} · {Number(r.samples).toLocaleString()} samples
                  </div>
                </div>
              );
            })}
          </div>

          {/* Per-metric good / needs-improvement / poor distribution. */}
          <div style={{ display: 'grid', gap: 8 }}>
            {METRIC_ORDER.filter(m => byMetric.has(m)).map(m => {
              const r = byMetric.get(m)!;
              const total = Number(r.samples) || 1;
              const segs: { k: Rating; v: number }[] = [
                { k: 'good', v: Number(r.good) },
                { k: 'needs-improvement', v: Number(r.needs_improvement) },
                { k: 'poor', v: Number(r.poor) },
              ];
              return (
                <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: '0 0 44px', fontSize: '0.7rem', fontWeight: 600, color: '#374151' }}>{m}</span>
                  <span style={{ flex: 1, display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#f3f4f6' }}>
                    {segs.map(s => s.v > 0 && (
                      <span key={s.k} title={`${s.k.replace('-', ' ')}: ${s.v.toLocaleString()}`} style={{ width: `${(s.v / total) * 100}%`, background: RATING_COLOR[s.k] }} />
                    ))}
                  </span>
                  <span style={{ flex: '0 0 auto', fontSize: '0.7rem', fontWeight: 600, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round((Number(r.good) / total) * 100)}% good
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
