'use client';

import { useMemo, useState } from 'react';
import { fmtInt, fmtCompact, fmtDateShort, pctDelta } from '@/components/admin/insights/format';
import { CHANNELS, type Channel, type ChannelDay, type GscDay, type IndexingBucket, type TrafficSearchData } from '@/lib/traffic-shared';

// ============================================================================
// Traffic & Search dashboard (Site Kit style): one 180-day dataset from the
// server, all interaction client-side. Three cards:
//   1. Channel growth — daily sessions per GA4 channel, toggleable legend,
//      crosshair tooltip, 7/30/90-day ranges, chart⇄table view.
//   2. Channel share — donut for the selected range with per-channel deltas.
//   3. Search performance — GSC impressions + clicks as two stacked panels
//      sharing one x-axis (never a dual-axis chart), CTR/position tiles,
//      top queries and top pages tables.
//
// Palette: fixed slot-per-channel, validated (CVD + normal-vision + contrast)
// against the white admin card. Identity is never color-alone: the legend
// always names series, the tooltip lists them, and the table view mirrors
// the chart (that table is also the relief for the sub-3:1 magenta/yellow
// slots the validator flags).
// ============================================================================

const CHANNEL_COLOR: Record<Channel, string> = {
  'Organic Search': '#2a78d6',
  'Direct':         '#008300',
  'Referral':       '#e87ba4',
  'Organic Social': '#eda100',
  'Paid':           '#1baf7a',
  'Email':          '#eb6834',
  'Other':          '#6b7280',
};

const RANGES = [{ d: 7, l: '7 days' }, { d: 30, l: '30 days' }, { d: 90, l: '90 days' }] as const;

const card: React.CSSProperties = {
  background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  padding: '20px 24px', marginBottom: 16,
};
const cardTitle: React.CSSProperties = { margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' };
const hintText: React.CSSProperties = { fontSize: '0.75rem', color: '#9ca3af' };

function RangePills({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 8, padding: 2 }}>
      {RANGES.map(r => (
        <button
          key={r.d}
          type="button"
          onClick={() => onChange(r.d)}
          style={{
            border: 'none', cursor: 'pointer', borderRadius: 6, padding: '5px 12px',
            fontSize: '0.75rem', fontWeight: 600,
            background: value === r.d ? 'white' : 'transparent',
            color: value === r.d ? '#111827' : '#6b7280',
            boxShadow: value === r.d ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          {r.l}
        </button>
      ))}
    </div>
  );
}

function DeltaPill({ delta, goodWhenUp = true }: { delta: number | null; goodWhenUp?: boolean }) {
  if (delta == null) return null;
  const good = goodWhenUp ? delta >= 0 : delta <= 0;
  return (
    <span style={{
      fontSize: '0.6875rem', fontWeight: 700, padding: '2px 7px', borderRadius: 100,
      background: good ? '#f0fdf4' : '#fef2f2', color: good ? '#15803d' : '#b91c1c',
    }}>
      {delta > 0 ? '▲' : delta < 0 ? '▼' : '•'} {Math.abs(delta)}%
    </span>
  );
}

const sumChannel = (days: ChannelDay[], ch: Channel) => days.reduce((s, d) => s + (d.sessions[ch] ?? 0), 0);
const sumAll = (days: ChannelDay[]) => days.reduce((s, d) => s + Object.values(d.sessions).reduce((a, v) => a + (v ?? 0), 0), 0);

// ─── 1 · Channel growth (multi-line, toggleable, crosshair) ─────────────────

function ChannelTrendCard({ daily }: { daily: ChannelDay[] }) {
  const [range, setRange] = useState(30);
  const [hidden, setHidden] = useState<Set<Channel>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const cur = useMemo(() => daily.slice(-range), [daily, range]);
  const prev = useMemo(() => daily.slice(-range * 2, -range), [daily, range]);

  // Channels that actually have data in the window, in fixed palette order.
  const present = CHANNELS.filter(ch => sumChannel(cur, ch) > 0 || sumChannel(prev, ch) > 0);
  const active = present.filter(ch => !hidden.has(ch));

  const toggle = (ch: Channel) => {
    setHidden(prevSet => {
      const next = new Set(prevSet);
      if (next.has(ch)) next.delete(ch); else next.add(ch);
      return next;
    });
  };

  // Geometry (responsive via viewBox; width is the layout's problem).
  const W = 760, H = 260, PAD_L = 40, PAD_R = 14, PAD_T = 14, PAD_B = 26;
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
  const n = cur.length;
  const max = Math.max(1, ...cur.flatMap(d => active.map(ch => d.sessions[ch] ?? 0)));
  const x = (i: number) => PAD_L + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD_T + plotH * (1 - v / max);
  const path = (ch: Channel) => cur.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.sessions[ch] ?? 0).toFixed(1)}`).join(' ');

  const yTicks = [0, 0.5, 1].map(f => Math.round(max * f));
  const xTicks = Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1].filter(i => i >= 0 && i < n)));

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD_L) / plotW) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };

  const hoverDay = hover != null ? cur[hover] : null;

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <div>
          <h3 style={cardTitle}>Traffic by channel</h3>
          <span style={hintText}>GA4 sessions per day · click a channel to show or hide it</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setAsTable(t => !t)}
            style={{ border: '1px solid #e5e7eb', background: 'white', borderRadius: 6, padding: '5px 10px', fontSize: '0.75rem', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
          >
            {asTable ? 'View chart' : 'View table'}
          </button>
          <RangePills value={range} onChange={setRange} />
        </div>
      </div>

      {/* Legend: totals + deltas double as the series toggles. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0 12px' }}>
        {present.map(ch => {
          const c = sumChannel(cur, ch);
          const p = sumChannel(prev, ch);
          const off = hidden.has(ch);
          return (
            <button
              key={ch}
              type="button"
              onClick={() => toggle(ch)}
              aria-pressed={!off}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
                border: '1px solid', borderColor: off ? '#e5e7eb' : CHANNEL_COLOR[ch],
                background: 'white', borderRadius: 100, padding: '5px 12px',
                opacity: off ? 0.45 : 1,
              }}
            >
              <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: CHANNEL_COLOR[ch] }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#111827' }}>{ch}</span>
              <span style={{ fontSize: '0.75rem', color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(c)}</span>
              <DeltaPill delta={pctDelta(c, p)} />
            </button>
          );
        })}
      </div>

      {n === 0 ? (
        <p style={{ ...hintText, padding: '24px 0' }}>No GA4 session data yet. It starts flowing within a day of connecting Google in Settings → Integrations.</p>
      ) : asTable ? (
        <div className="adm-table-scroll" style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6b7280', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Day</th>
                {active.map(ch => (
                  <th key={ch} style={{ textAlign: 'right', padding: '8px 10px', color: '#6b7280', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{ch}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...cur].reverse().map(d => (
                <tr key={d.date} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{fmtDateShort(d.date)}</td>
                  {active.map(ch => (
                    <td key={ch} style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(d.sessions[ch] ?? 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            role="img"
            aria-label="Daily sessions per traffic channel"
          >
            {yTicks.map(t => (
              <g key={t}>
                <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="#f3f4f6" strokeWidth={1} />
                <text x={PAD_L - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="#9ca3af">{fmtCompact(t)}</text>
              </g>
            ))}
            {xTicks.map(i => (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#9ca3af">{fmtDateShort(cur[i].date)}</text>
            ))}
            {active.map(ch => (
              <path key={ch} d={path(ch)} fill="none" stroke={CHANNEL_COLOR[ch]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {hover != null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={PAD_T} y2={PAD_T + plotH} stroke="#d1d5db" strokeWidth={1} strokeDasharray="3 3" />
                {active.map(ch => (
                  <circle key={ch} cx={x(hover)} cy={y(cur[hover].sessions[ch] ?? 0)} r={4} fill={CHANNEL_COLOR[ch]} stroke="white" strokeWidth={2} />
                ))}
              </g>
            )}
          </svg>
          {hoverDay && hover != null && (
            <div style={{
              position: 'absolute', top: 8,
              left: `${(x(hover) / W) * 100}%`,
              transform: hover > n / 2 ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)',
              background: '#111827', color: 'white', borderRadius: 8, padding: '8px 12px',
              fontSize: '0.75rem', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 5,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{fmtDateShort(hoverDay.date)}</div>
              {active.map(ch => (
                <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: CHANNEL_COLOR[ch] }} />
                  <span style={{ opacity: 0.85 }}>{ch}</span>
                  <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', paddingLeft: 10 }}>{fmtInt(hoverDay.sessions[ch] ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 2 · Channel share donut ─────────────────────────────────────────────────

function DonutCard({ daily }: { daily: ChannelDay[] }) {
  const [range, setRange] = useState(30);
  const cur = useMemo(() => daily.slice(-range), [daily, range]);
  const prev = useMemo(() => daily.slice(-range * 2, -range), [daily, range]);
  const total = sumAll(cur);

  const slices = CHANNELS
    .map(ch => ({ ch, value: sumChannel(cur, ch), prevValue: sumChannel(prev, ch) }))
    .filter(s => s.value > 0);

  // Donut geometry: 2px surface gaps between segments via stroke. Offsets are
  // cumulative fractions, computed immutably (reduce) to satisfy the
  // react-hooks immutability rule for render-scope values.
  const R = 62, STROKE = 22, C = 2 * Math.PI * R;
  const segs = slices.reduce<Array<(typeof slices)[number] & { frac: number; offset: number }>>((out, s) => {
    const frac = total > 0 ? s.value / total : 0;
    const offset = out.length > 0 ? out[out.length - 1].offset + out[out.length - 1].frac : 0;
    out.push({ ...s, frac, offset });
    return out;
  }, []);

  return (
    <div style={{ ...card, marginBottom: 0, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={cardTitle}>Where sessions come from</h3>
          <span style={hintText}>Share of GA4 sessions in the selected range</span>
        </div>
        <RangePills value={range} onChange={setRange} />
      </div>
      {total === 0 ? (
        <p style={{ ...hintText, padding: '24px 0' }}>No session data in this range yet.</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', marginTop: 14 }}>
          <svg width={160} height={160} viewBox="0 0 160 160" role="img" aria-label="Traffic share by channel">
            <g transform="rotate(-90 80 80)">
              {segs.map(s => (
                <circle
                  key={s.ch}
                  cx={80} cy={80} r={R}
                  fill="none"
                  stroke={CHANNEL_COLOR[s.ch]}
                  strokeWidth={STROKE}
                  strokeDasharray={`${Math.max(0, s.frac * C - 2)} ${C}`}
                  strokeDashoffset={-s.offset * C}
                />
              ))}
            </g>
            <text x={80} y={76} textAnchor="middle" fontSize={22} fontWeight={700} fill="#111827">{fmtCompact(total)}</text>
            <text x={80} y={94} textAnchor="middle" fontSize={10} fill="#9ca3af">sessions</text>
          </svg>
          <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {segs.map(s => (
              <div key={s.ch} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: CHANNEL_COLOR[s.ch], flexShrink: 0 }} />
                <span style={{ color: '#111827', fontWeight: 600 }}>{s.ch}</span>
                <span style={{ marginLeft: 'auto', color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtInt(s.value)} · {Math.round(s.frac * 100)}%
                </span>
                <DeltaPill delta={pctDelta(s.value, s.prevValue)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 3 · Search performance (GSC) ────────────────────────────────────────────

function SearchPerfCard({ daily }: { daily: GscDay[] }) {
  const [range, setRange] = useState(30);
  const [hover, setHover] = useState<number | null>(null);
  const cur = useMemo(() => daily.slice(-range), [daily, range]);
  const prev = useMemo(() => daily.slice(-range * 2, -range), [daily, range]);

  const sums = (rows: GscDay[]) => ({
    clicks: rows.reduce((s, d) => s + d.clicks, 0),
    impressions: rows.reduce((s, d) => s + d.impressions, 0),
    // Impression-weighted, matching how Search Console itself aggregates.
    ctr: rows.reduce((s, d) => s + d.impressions, 0) > 0
      ? rows.reduce((s, d) => s + d.ctr * d.impressions, 0) / rows.reduce((s, d) => s + d.impressions, 0)
      : 0,
    position: rows.reduce((s, d) => s + d.impressions, 0) > 0
      ? rows.reduce((s, d) => s + d.position * d.impressions, 0) / rows.reduce((s, d) => s + d.impressions, 0)
      : 0,
  });
  const c = sums(cur), p = sums(prev);

  // Two stacked panels, one shared x-axis — never a dual-axis chart.
  const W = 760, PAD_L = 40, PAD_R = 14;
  const plotW = W - PAD_L - PAD_R;
  const n = cur.length;
  const x = (i: number) => PAD_L + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);

  const panel = (vals: number[], top: number, h: number) => {
    const max = Math.max(1, ...vals);
    const y = (v: number) => top + h * (1 - v / max);
    const line = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const area = n > 0 ? `${line} L${x(n - 1).toFixed(1)},${top + h} L${x(0).toFixed(1)},${top + h} Z` : '';
    return { max, y, line, area };
  };
  const IMP_TOP = 14, IMP_H = 110, CLK_TOP = 152, CLK_H = 80, H = 258;
  const imp = panel(cur.map(d => d.impressions), IMP_TOP, IMP_H);
  const clk = panel(cur.map(d => d.clicks), CLK_TOP, CLK_H);
  const xTicks = Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1].filter(i => i >= 0 && i < n)));

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD_L) / plotW) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };

  const tiles = [
    { label: 'Clicks', value: fmtInt(c.clicks), delta: pctDelta(c.clicks, p.clicks), goodWhenUp: true },
    { label: 'Impressions', value: fmtInt(c.impressions), delta: pctDelta(c.impressions, p.impressions), goodWhenUp: true },
    { label: 'Avg CTR', value: `${(c.ctr * 100).toFixed(1)}%`, delta: pctDelta(c.ctr * 1000, p.ctr * 1000), goodWhenUp: true },
    { label: 'Avg position', value: c.position ? c.position.toFixed(1) : '—', delta: pctDelta(Math.round(c.position * 10), Math.round(p.position * 10)), goodWhenUp: false },
  ];

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h3 style={cardTitle}>Google Search performance</h3>
          <span style={hintText}>Search Console · impressions (top) and clicks (bottom) share the same days</span>
        </div>
        <RangePills value={range} onChange={setRange} />
      </div>

      <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {tiles.map(t => (
          <div key={t.label} style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{t.value}</span>
              <DeltaPill delta={t.delta} goodWhenUp={t.goodWhenUp} />
            </div>
          </div>
        ))}
      </div>

      {n === 0 ? (
        <p style={{ ...hintText, padding: '12px 0' }}>No Search Console data yet for this range.</p>
      ) : (
        <div style={{ position: 'relative' }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            role="img"
            aria-label="Daily Search Console impressions and clicks"
          >
            {/* Impressions panel. Labels wear ink; the swatch carries identity. */}
            <rect x={PAD_L} y={IMP_TOP - 10} width={8} height={8} rx={2} fill="#2a78d6" />
            <text x={PAD_L + 12} y={IMP_TOP - 2} fontSize={10} fontWeight={700} fill="#6b7280">IMPRESSIONS</text>
            <line x1={PAD_L} x2={W - PAD_R} y1={IMP_TOP + IMP_H} y2={IMP_TOP + IMP_H} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD_L - 6} y={IMP_TOP + 8} textAnchor="end" fontSize={10} fill="#9ca3af">{fmtCompact(imp.max)}</text>
            <path d={imp.area} fill="#2a78d6" opacity={0.12} />
            <path d={imp.line} fill="none" stroke="#2a78d6" strokeWidth={2} strokeLinejoin="round" />

            {/* Clicks panel */}
            <rect x={PAD_L} y={CLK_TOP - 10} width={8} height={8} rx={2} fill="#008300" />
            <text x={PAD_L + 12} y={CLK_TOP - 2} fontSize={10} fontWeight={700} fill="#6b7280">CLICKS</text>
            <line x1={PAD_L} x2={W - PAD_R} y1={CLK_TOP + CLK_H} y2={CLK_TOP + CLK_H} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD_L - 6} y={CLK_TOP + 8} textAnchor="end" fontSize={10} fill="#9ca3af">{fmtCompact(clk.max)}</text>
            <path d={clk.area} fill="#008300" opacity={0.12} />
            <path d={clk.line} fill="none" stroke="#008300" strokeWidth={2} strokeLinejoin="round" />

            {xTicks.map(i => (
              <text key={i} x={x(i)} y={H - 4} textAnchor="middle" fontSize={10} fill="#9ca3af">{fmtDateShort(cur[i].date)}</text>
            ))}

            {hover != null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={IMP_TOP} y2={CLK_TOP + CLK_H} stroke="#d1d5db" strokeWidth={1} strokeDasharray="3 3" />
                <circle cx={x(hover)} cy={imp.y(cur[hover].impressions)} r={4} fill="#2a78d6" stroke="white" strokeWidth={2} />
                <circle cx={x(hover)} cy={clk.y(cur[hover].clicks)} r={4} fill="#008300" stroke="white" strokeWidth={2} />
              </g>
            )}
          </svg>
          {hover != null && cur[hover] && (
            <div style={{
              position: 'absolute', top: 4,
              left: `${(x(hover) / W) * 100}%`,
              transform: hover > n / 2 ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)',
              background: '#111827', color: 'white', borderRadius: 8, padding: '8px 12px',
              fontSize: '0.75rem', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 5,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{fmtDateShort(cur[hover].date)}</div>
              <div>Impressions <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtInt(cur[hover].impressions)}</b></div>
              <div>Clicks <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtInt(cur[hover].clicks)}</b></div>
              <div>Position <b style={{ fontVariantNumeric: 'tabular-nums' }}>{cur[hover].position.toFixed(1)}</b></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 4 · Top queries / pages tables ─────────────────────────────────────────

function GscTable({ title, hint, rows, keyLabel, formatKey }: {
  title: string; hint: string; rows: TrafficSearchData['topQueries'];
  keyLabel: string; formatKey?: (k: string) => string;
}) {
  const [filter, setFilter] = useState('');
  const shown = rows.filter(r => (r.keys[0] ?? '').toLowerCase().includes(filter.toLowerCase()));
  const maxImp = Math.max(1, ...rows.map(r => r.impressions));
  return (
    <div style={{ ...card, marginBottom: 0, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <h3 style={cardTitle}>{title}</h3>
          <span style={hintText}>{hint}</span>
        </div>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter…"
          aria-label={`Filter ${title}`}
          style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 10px', fontSize: '0.75rem', width: 120 }}
        />
      </div>
      {shown.length === 0 ? (
        <p style={{ ...hintText, padding: '12px 0' }}>{rows.length === 0 ? 'No data yet — Search Console reports lag by two to three days.' : 'Nothing matches the filter.'}</p>
      ) : (
        <div className="adm-table-scroll" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                {[keyLabel, 'Clicks', 'Impr.', 'CTR', 'Pos.'].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '6px 8px', color: '#6b7280', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #f3f4f6' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map(r => {
                const k = r.keys[0] ?? '';
                return (
                  <tr key={k} style={{ borderBottom: '1px solid #f9fafb' }}>
                    <td style={{ padding: '7px 8px', maxWidth: 260 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#111827' }} title={k}>
                        {formatKey ? formatKey(k) : k}
                      </div>
                      {/* Impression share micro-bar: magnitude at a glance. */}
                      <div aria-hidden="true" style={{ height: 3, borderRadius: 2, background: '#eff6ff', marginTop: 3, position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: 0, width: `${Math.max(2, (r.impressions / maxImp) * 100)}%`, background: '#2a78d6', borderRadius: 2 }} />
                      </div>
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtInt(r.clicks)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>{fmtInt(r.impressions)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>{(r.ctr * 100).toFixed(1)}%</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>{r.position.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── 5 · Indexing status ─────────────────────────────────────────────────────

// Status semantics (good / progressing / attention), always paired with the
// label and count — never color alone.
function indexingTone(state: string): { color: string; bg: string } {
  if (/indexed/i.test(state) && !/not indexed/i.test(state)) return { color: '#15803d', bg: '#f0fdf4' };
  if (/discovered|crawled/i.test(state)) return { color: '#a16207', bg: '#fefce8' };
  if (/unknown/i.test(state)) return { color: '#6b7280', bg: '#f9fafb' };
  return { color: '#6b7280', bg: '#f9fafb' };
}

function IndexingCard({ buckets }: { buckets: IndexingBucket[] }) {
  const total = buckets.reduce((s, b) => s + b.count, 0);
  return (
    <div style={{ ...card, marginBottom: 0, height: '100%' }}>
      <h3 style={cardTitle}>Indexing status</h3>
      <span style={hintText}>{fmtInt(total)} tracked URLs · from the daily Search Console check · <a href="/admin/indexing" style={{ color: '#C5286A', fontWeight: 600 }}>details</a></span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {buckets.map(b => {
          const tone = indexingTone(b.state);
          const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
          return (
            <div key={b.state}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 3 }}>
                <span style={{ color: '#111827' }}>{b.state}</span>
                <span style={{ color: tone.color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(b.count)} · {pct}%</span>
              </div>
              <div aria-hidden="true" style={{ height: 6, borderRadius: 3, background: '#f3f4f6', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, width: `${Math.max(1, pct)}%`, background: tone.color, borderRadius: 3, opacity: 0.75 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Assembly ────────────────────────────────────────────────────────────────

export function TrafficSearchDashboard({ data }: { data: TrafficSearchData }) {
  return (
    <div>
      {!data.connected && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: '0.8125rem', color: '#92400e' }}>
          Google isn&apos;t connected, so these charts run on stored history only. Connect it in{' '}
          <a href="/admin/settings/integrations" style={{ color: '#C5286A', fontWeight: 700 }}>Settings → Integrations</a> for live channel and query data.
        </div>
      )}
      <ChannelTrendCard daily={data.channelDaily} />
      <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 16 }}>
        <DonutCard daily={data.channelDaily} />
        <IndexingCard buckets={data.indexing} />
      </div>
      <SearchPerfCard daily={data.gscDaily} />
      <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <GscTable title="Top search queries" hint="Last 28 days, by clicks" rows={data.topQueries} keyLabel="Query" />
        <GscTable
          title="Top pages in search"
          hint="Last 28 days, by clicks"
          rows={data.topPages}
          keyLabel="Page"
          formatKey={k => { try { return new URL(k).pathname || '/'; } catch { return k; } }}
        />
      </div>
    </div>
  );
}
