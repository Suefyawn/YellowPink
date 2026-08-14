'use client';

import { PK_TZ } from '@/lib/dates';

// New-vs-returning revenue as stacked bars, one bucket per day/week/month —
// the Shopify "Customers over time" reading applied to revenue. Same
// hand-rolled SVG layout as RevenueChart (shared gutters, fmtK y-scale,
// collision-free x ticks) so the Sales tab's two charts read as one system.
// New-customer revenue sits at the bottom in brand yellow; returning revenue
// stacks on top in the deep admin pink.

export interface NewReturningBucket {
  date: string; // 'YYYY-MM-DD' (bucket start)
  newRev: number;
  retRev: number;
}

const NEW_COLOR = '#F7C948';
const RET_COLOR = '#C5286A';

const fmtK = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
};

type Granularity = 'day' | 'week' | 'month';

// Parse the bucket day as UTC and render in PK time so the label always
// equals the bucket day, independent of server/browser timezone.
const fmtDate = (iso: string, granularity: Granularity = 'day') =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-PK',
    granularity === 'month'
      ? { month: 'short', year: '2-digit', timeZone: PK_TZ }
      : { day: 'numeric', month: 'short', timeZone: PK_TZ });

export function NewReturningChart({ buckets, granularity = 'day' }: { buckets: NewReturningBucket[]; granularity?: Granularity }) {
  if (buckets.length === 0 || buckets.every(b => b.newRev === 0 && b.retRev === 0)) {
    return (
      <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
        No revenue data in this window yet
      </div>
    );
  }

  // Same viewBox geometry as RevenueChart: a left gutter for the y-scale and
  // a bottom gutter for date labels, kept clear of the plot.
  const PAD_L = 42, PAD_R = 10, PAD_T = 14, PAD_B = 24;
  const W = 680, H = 220;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const max = Math.max(...buckets.map(b => b.newRev + b.retRev), 1);
  const slot = plotW / buckets.length;
  const barW = Math.max(2, slot * 0.68);

  // X-axis ticks: first, last and a few evenly spaced interior points.
  const tickCount = Math.min(buckets.length, 5);
  const ticks = new Set(
    Array.from({ length: tickCount }, (_, k) =>
      Math.round((k / Math.max(tickCount - 1, 1)) * (buckets.length - 1)),
    ),
  );

  return (
    <>
      {/* Legend — plain swatches, inherits the card's type scale. */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: '0.75rem', color: '#6b7280' }}>
        {[{ label: 'New customers', color: NEW_COLOR }, { label: 'Returning customers', color: RET_COLOR }].map(l => (
          <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: l.color, display: 'inline-block' }} />
            {l.label}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="New versus returning customer revenue"
      >
        {/* Y gridlines + scale */}
        {[0, 0.5, 1].map(f => {
          const y = PAD_T + plotH * (1 - f);
          return (
            <g key={f}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#f3f4f6" strokeWidth={1} />
              <text x={PAD_L - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill="#9ca3af">
                {fmtK(max * f)}
              </text>
            </g>
          );
        })}

        {/* Stacked bars: new on the bottom, returning on top. */}
        {buckets.map((b, i) => {
          const cx = PAD_L + slot * i + slot / 2;
          const total = b.newRev + b.retRev;
          const newH = (b.newRev / max) * plotH;
          const retH = (b.retRev / max) * plotH;
          const baseY = PAD_T + plotH;
          const labelAnchor = i === 0 ? 'start' : i === buckets.length - 1 ? 'end' : 'middle';
          const labelX = i === 0 ? PAD_L : i === buckets.length - 1 ? W - PAD_R : cx;
          const title = `${fmtDate(b.date, granularity)}, new PKR ${Math.round(b.newRev).toLocaleString()}, returning PKR ${Math.round(b.retRev).toLocaleString()}`;
          return (
            <g key={b.date}>
              {total > 0 && b.newRev > 0 && (
                <rect x={cx - barW / 2} y={baseY - Math.max(1, newH)} width={barW} height={Math.max(1, newH)} rx={1} fill={NEW_COLOR}>
                  <title>{title}</title>
                </rect>
              )}
              {total > 0 && b.retRev > 0 && (
                <rect x={cx - barW / 2} y={baseY - newH - Math.max(1, retH)} width={barW} height={Math.max(1, retH)} rx={1} fill={RET_COLOR}>
                  <title>{title}</title>
                </rect>
              )}
              {ticks.has(i) && (
                <text x={labelX} y={H - 7} textAnchor={labelAnchor} fontSize="10" fill="#9ca3af">
                  {fmtDate(b.date, granularity)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </>
  );
}
