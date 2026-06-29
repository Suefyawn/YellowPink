'use client';

import { useMemo, useState } from 'react';

// Shopify-style store overview: a row of clickable metric tiles (each with its
// own trend vs the previous period + a mini sparkline) driving one large
// interactive line chart with a dotted previous-period comparison line and a
// hover tooltip. Replaces the old static stat cards + basic revenue bar chart.
//
// All data (a ~90-day daily series) is passed once from the server; the range
// toggle just slices it client-side, so switching 7/30/90 days is instant and
// needs no refetch.

export interface OverviewDay {
  date: string;            // YYYY-MM-DD
  revenue: number;
  orders: number;
  sessions: number | null; // GA4; null until the SEO trend cron has run
}

type MetricKey = 'sales' | 'orders' | 'aov' | 'sessions';

interface MetricDef {
  key: MetricKey;
  label: string;
  color: string;
  // value at a given day (for the chart series + sparkline)
  at: (d: OverviewDay) => number | null;
  // window aggregate shown on the tile (sum, or AOV = revenue/orders)
  agg: (days: OverviewDay[]) => number;
  fmt: (n: number) => string;
}

const PKR = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;
const INT = (n: number) => Math.round(n).toLocaleString();
const sum = (days: OverviewDay[], f: (d: OverviewDay) => number | null) => days.reduce((s, d) => s + (f(d) ?? 0), 0);

const METRICS: MetricDef[] = [
  { key: 'sales',    label: 'Total sales',     color: '#10b981', at: d => d.revenue,  agg: ds => sum(ds, d => d.revenue), fmt: PKR },
  { key: 'orders',   label: 'Orders',          color: '#C5286A', at: d => d.orders,   agg: ds => sum(ds, d => d.orders),  fmt: INT },
  { key: 'aov',      label: 'Avg order value', color: '#6366f1', at: d => (d.orders > 0 ? d.revenue / d.orders : 0), agg: ds => { const o = sum(ds, d => d.orders); return o > 0 ? sum(ds, d => d.revenue) / o : 0; }, fmt: PKR },
  { key: 'sessions', label: 'Sessions',        color: '#0ea5e9', at: d => d.sessions, agg: ds => sum(ds, d => d.sessions), fmt: INT },
];

const RANGES = [{ d: 7, l: '7 days' }, { d: 30, l: '30 days' }, { d: 90, l: '90 days' }];

const fmtDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });

export function OverviewChart({ series }: { series: OverviewDay[] }) {
  const [metricKey, setMetricKey] = useState<MetricKey>('sales');
  const [range, setRange] = useState(30);
  const [hover, setHover] = useState<number | null>(null);

  const metric = METRICS.find(m => m.key === metricKey)!;
  const hasSessions = series.some(d => d.sessions != null);

  // Current window = last `range` days; previous window = the `range` days before it.
  const cur = useMemo(() => series.slice(-range), [series, range]);
  const prev = useMemo(() => series.slice(-range * 2, -range), [series, range]);

  // Per-tile aggregate + delta vs previous window.
  const tiles = METRICS.map(m => {
    const c = m.agg(cur);
    const p = m.agg(prev);
    const delta = p > 0 ? Math.round(((c - p) / p) * 100) : (c > 0 ? 100 : null);
    return { m, value: c, delta };
  });

  // ── chart geometry ──
  const W = 720, H = 240, PAD_L = 48, PAD_R = 12, PAD_T = 16, PAD_B = 26;
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
  const curVals = cur.map(d => metric.at(d) ?? 0);
  const prevVals = prev.map(d => metric.at(d) ?? 0);
  const max = Math.max(1, ...curVals, ...prevVals);
  const n = cur.length;
  const x = (i: number) => PAD_L + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD_T + plotH * (1 - v / max);
  const line = (vals: number[]) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line(curVals)} L${x(n - 1).toFixed(1)},${(PAD_T + plotH).toFixed(1)} L${x(0).toFixed(1)},${(PAD_T + plotH).toFixed(1)} Z`;

  const fmtAxis = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)));
  const xTicks = Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1].filter(i => i >= 0 && i < n)));

  return (
    <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: 32 }}>
      {/* Mobile: the 4-up metric tiles collapse to a 2×2 grid with tighter
          padding so each value stays legible on a phone. */}
      <style>{`
        @media (max-width: 640px) {
          .adm-overview-tiles { grid-template-columns: repeat(2, 1fr) !important; }
          .adm-overview-tiles > button { padding: 12px 14px !important; }
          .adm-overview-tiles > button:nth-child(even) { border-right: none !important; }
          .adm-overview-tiles > button:nth-child(-n+2) { border-bottom: 1px solid #f3f4f6 !important; }
          .adm-ov-val { font-size: 1.2rem !important; }
          .adm-ov-head { padding: 14px 16px 0 !important; }
          .adm-ov-chart { padding: 14px 12px 6px !important; }
          .adm-ov-legend { padding: 0 16px 14px !important; }
        }
      `}</style>
      {/* Range toggle */}
      <div className="adm-ov-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 0', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#111827' }}>Overview</h2>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGES.map(r => {
            const active = range === r.d;
            return (
              <button key={r.d} onClick={() => { setRange(r.d); setHover(null); }} style={{
                padding: '5px 12px', borderRadius: 16, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                border: 'none', background: active ? '#111827' : '#f3f4f6', color: active ? '#fff' : '#6b7280',
              }}>{r.l}</button>
            );
          })}
        </div>
      </div>

      {/* Metric tiles — click to plot */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid #f3f4f6' }} className="adm-overview-tiles">
        {tiles.map(({ m, value, delta }) => {
          const active = m.key === metricKey;
          const disabled = m.key === 'sessions' && !hasSessions;
          const up = (delta ?? 0) >= 0;
          // sparkline
          const sv = cur.map(d => m.at(d) ?? 0);
          const smax = Math.max(1, ...sv);
          return (
            <button
              key={m.key}
              onClick={() => !disabled && setMetricKey(m.key)}
              disabled={disabled}
              style={{
                textAlign: 'left', padding: '16px 18px', border: 'none', cursor: disabled ? 'default' : 'pointer',
                background: active ? '#fafafa' : '#fff', borderTop: active ? `2px solid ${m.color}` : '2px solid transparent',
                borderRight: '1px solid #f3f4f6', opacity: disabled ? 0.5 : 1,
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</div>
              <div className="adm-ov-val" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                {disabled ? '—' : m.fmt(value)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, minHeight: 18 }}>
                {!disabled && delta != null && (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: up ? '#10b981' : '#ef4444' }}>
                    {up ? '▲' : '▼'} {Math.abs(delta)}%
                  </span>
                )}
                {!disabled && (
                  <svg width="56" height="16" viewBox="0 0 56 16" preserveAspectRatio="none" style={{ flex: 1 }}>
                    <polyline
                      points={sv.map((v, i) => `${(i / Math.max(sv.length - 1, 1)) * 56},${16 - (v / smax) * 15}`).join(' ')}
                      fill="none" stroke={m.color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"
                    />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Big interactive chart */}
      <div className="adm-ov-chart" style={{ padding: '18px 20px 8px', position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'pan-y' }} role="img" aria-label={`${metric.label} over ${range} days`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={e => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            const i = Math.round(((px - PAD_L) / plotW) * (n - 1));
            setHover(Math.max(0, Math.min(n - 1, i)));
          }}
          onTouchStart={e => {
            const t = e.touches[0]; if (!t) return;
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = ((t.clientX - rect.left) / rect.width) * W;
            const i = Math.round(((px - PAD_L) / plotW) * (n - 1));
            setHover(Math.max(0, Math.min(n - 1, i)));
          }}
          onTouchMove={e => {
            const t = e.touches[0]; if (!t) return;
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = ((t.clientX - rect.left) / rect.width) * W;
            const i = Math.round(((px - PAD_L) / plotW) * (n - 1));
            setHover(Math.max(0, Math.min(n - 1, i)));
          }}
          onTouchEnd={() => setHover(null)}
        >
          {/* y gridlines + scale */}
          {[0, 0.5, 1].map(f => {
            const gy = PAD_T + plotH * (1 - f);
            return (
              <g key={f}>
                <line x1={PAD_L} y1={gy} x2={W - PAD_R} y2={gy} stroke="#f3f4f6" strokeWidth={1} />
                <text x={PAD_L - 8} y={gy + 3.5} textAnchor="end" fontSize="10" fill="#9ca3af">{fmtAxis(max * f)}</text>
              </g>
            );
          })}
          {/* previous-period comparison (dotted) */}
          {prevVals.length > 1 && (
            <path d={line(prevVals.slice(0, n))} fill="none" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="3 3" />
          )}
          {/* current period area + line */}
          <path d={area} fill={metric.color} opacity={0.08} />
          <path d={line(curVals)} fill="none" stroke={metric.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {/* x labels */}
          {xTicks.map(i => (
            <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="10" fill="#9ca3af">{fmtDay(cur[i].date)}</text>
          ))}
          {/* hover crosshair + marker */}
          {hover != null && (
            <g>
              <line x1={x(hover)} y1={PAD_T} x2={x(hover)} y2={PAD_T + plotH} stroke="#d1d5db" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(curVals[hover])} r={4} fill={metric.color} stroke="#fff" strokeWidth={2} />
            </g>
          )}
        </svg>
        {/* hover tooltip */}
        {hover != null && (
          <div style={{
            position: 'absolute', top: 12, left: `${(x(hover) / W) * 100}%`, transform: 'translateX(-50%)',
            background: '#111827', color: '#fff', padding: '6px 10px', borderRadius: 8, fontSize: '0.72rem',
            pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          }}>
            <div style={{ fontWeight: 700 }}>{metric.fmt(curVals[hover])}</div>
            <div style={{ color: '#9ca3af' }}>{fmtDay(cur[hover].date)}</div>
          </div>
        )}
      </div>
      <div className="adm-ov-legend" style={{ display: 'flex', gap: 16, padding: '0 20px 16px', fontSize: '0.7rem', color: '#9ca3af' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 2, background: metric.color, verticalAlign: 'middle', marginRight: 4 }} />This period</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 0, borderTop: '2px dashed #cbd5e1', verticalAlign: 'middle', marginRight: 4 }} />Previous period</span>
      </div>
    </div>
  );
}
