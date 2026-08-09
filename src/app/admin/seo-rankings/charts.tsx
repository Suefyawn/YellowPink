// Server-rendered SVG charts for the SEO rankings page. No client JS: hover
// detail rides on native SVG <title> tooltips, identity on direct labels and
// the text beside each chart — so the charts stay zero-bundle and printable.
//
// Colors validated with the dataviz palette checker (light surface):
//   impressions #C5286A / clicks #0369a1 — categorical pair, all checks pass.
//   Position meter: ordered single-hue ramp (monotonic lightness, adjacent
//   ΔE ≥ 16), 2px gaps + direct labels carry identity, never color alone.

interface DayPoint { day: string; value: number }

const AXIS = '#9ca3af';
const GRID = '#f3f4f6';

function niceMax(v: number): number {
  if (v <= 5) return Math.max(v, 1);
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag) * mag;
}

const shortDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};

/** Single-series daily trend: 'area' for dense counts (impressions), 'bar'
 *  for small integers (clicks). One measure per chart — never a dual axis. */
export function TrendChart({ title, points, color, kind }: {
  title: string; points: DayPoint[]; color: string; kind: 'area' | 'bar';
}) {
  const w = 460, h = 130, padL = 34, padR = 8, padT = 8, padB = 20;
  const iw = w - padL - padR, ih = h - padT - padB;
  const max = niceMax(Math.max(...points.map(p => p.value), 1));
  const x = (i: number) => padL + (points.length <= 1 ? iw / 2 : (i * iw) / (points.length - 1));
  const y = (v: number) => padT + ih - (v / max) * ih;
  const last = points[points.length - 1];
  const gridYs = [0, 0.5, 1].map(f => padT + ih - f * ih);

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', flex: '1 1 320px', minWidth: 300 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280' }}>{title}</span>
        <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
          {points.reduce((s, p) => s + p.value, 0).toLocaleString()}
          <span style={{ fontSize: '0.6875rem', fontWeight: 400, color: '#9ca3af' }}> · 28 days</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${title}, last ${points.length} days`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {gridYs.map((gy, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={gy} y2={gy} stroke={GRID} strokeWidth="1" />
            <text x={padL - 6} y={gy + 3} textAnchor="end" fontSize="9" fill={AXIS} fontVariant="tabular-nums">
              {Math.round(max * (1 - (gy - padT) / ih)).toLocaleString()}
            </text>
          </g>
        ))}
        {kind === 'area' ? (
          <>
            <path
              d={`M ${x(0)} ${y(points[0].value)} ${points.map((p, i) => `L ${x(i)} ${y(p.value)}`).join(' ')} L ${x(points.length - 1)} ${padT + ih} L ${x(0)} ${padT + ih} Z`}
              fill={color} opacity="0.12"
            />
            <polyline
              points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
              fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            />
            {points.map((p, i) => (
              <circle key={p.day} cx={x(i)} cy={y(p.value)} r="6" fill="transparent">
                <title>{`${shortDay(p.day)}: ${p.value.toLocaleString()}`}</title>
              </circle>
            ))}
            <circle cx={x(points.length - 1)} cy={y(last.value)} r="3" fill={color} stroke="#fff" strokeWidth="2" />
          </>
        ) : (
          points.map((p, i) => {
            const bw = Math.max(2, iw / points.length - 2);
            const bh = Math.max((p.value / max) * ih, p.value > 0 ? 2 : 0);
            return (
              <rect key={p.day} x={x(i) - bw / 2} y={padT + ih - bh} width={bw} height={bh || 0.01}
                rx="2" fill={p.value > 0 ? color : GRID}>
                <title>{`${shortDay(p.day)}: ${p.value.toLocaleString()}`}</title>
              </rect>
            );
          })
        )}
        <text x={padL} y={h - 5} fontSize="9" fill={AXIS}>{shortDay(points[0].day)}</text>
        <text x={w - padR} y={h - 5} textAnchor="end" fontSize="9" fill={AXIS}>{shortDay(last.day)}</text>
        {/* Selective direct label: the latest value only. */}
        <text x={Math.min(x(points.length - 1), w - padR - 2)} y={Math.max(y(last.value) - 7, 10)} textAnchor="end" fontSize="10" fontWeight="700" fill="#111827" fontVariant="tabular-nums">
          {last.value.toLocaleString()}
        </text>
      </svg>
    </div>
  );
}

/** Ordered distribution of tracked keywords across position buckets: one
 *  proportional bar, 2px gaps, every segment labeled in the legend row. */
export function PositionMeter({ buckets }: {
  buckets: { label: string; count: number; color: string; ink?: string }[];
}) {
  const total = buckets.reduce((s, b) => s + b.count, 0);
  if (total === 0) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', marginBottom: 10 }}>
        Where the {total} tracked keywords rank (Semrush, Pakistan)
      </div>
      <div style={{ display: 'flex', gap: 2, height: 18, borderRadius: 5, overflow: 'hidden' }}>
        {buckets.filter(b => b.count > 0).map(b => (
          <div key={b.label} title={`${b.label}: ${b.count} keyword${b.count === 1 ? '' : 's'}`}
            style={{ flexGrow: b.count, flexBasis: 0, background: b.color, minWidth: 6 }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 10 }}>
        {buckets.map(b => (
          <span key={b.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#374151' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: b.color, border: '1px solid rgba(0,0,0,0.06)' }} />
            {b.label} <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{b.count}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Biggest daily-Google movers over the sparkline window: two labeled columns,
 *  green/red polarity with the direction glyph (never color alone). */
export function MoversPanel({ movers }: {
  movers: { keyword: string; from: number; to: number; delta: number }[];
}) {
  const up = movers.filter(m => m.delta > 0).slice(0, 5);
  const down = movers.filter(m => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5);
  if (up.length === 0 && down.length === 0) return null;
  const col = (title: string, list: typeof movers, colr: string, glyph: string) => (
    <div style={{ flex: '1 1 260px', minWidth: 240 }}>
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', marginBottom: 8 }}>{title}</div>
      {list.length === 0 ? (
        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>None in this window.</div>
      ) : list.map(m => (
        <div key={m.keyword} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '5px 0', borderBottom: '1px solid #f9fafb', fontSize: '0.8125rem' }}>
          <span style={{ color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.keyword}</span>
          <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>
            {m.from.toFixed(0)} → {m.to.toFixed(0)}{' '}
            <strong style={{ color: colr }}>{glyph} {Math.abs(m.delta).toFixed(0)}</strong>
          </span>
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        {col('Climbing (daily Google position)', up, '#15803d', '▲')}
        {col('Slipping', down, '#b91c1c', '▼')}
      </div>
    </div>
  );
}
