import Link from 'next/link';
import { Sparkline } from './Sparkline';

// The one KPI card for every insight surface: coloured accent bar, label,
// big tabular value, an optional period-over-period delta pill, an optional
// sparkline, and an optional drill-through link (the whole card is the
// target). Server-safe — no state, no handlers.

export interface KpiDelta {
  pct: number;
  // Whether an increase is good news (revenue: yes; error count: no).
  // Drives the pill colour, not the arrow direction.
  goodWhenUp?: boolean;
  // What the delta compares against, e.g. "vs last Thursday" / "vs prev 30d".
  vs?: string;
}

export function KpiCard({
  label,
  value,
  href,
  accent = '#C5286A',
  delta,
  spark,
  hint,
}: {
  label: string;
  value: string | number;
  href?: string;
  accent?: string;
  delta?: KpiDelta | null;
  spark?: number[];
  hint?: string;
}) {
  const up = delta ? delta.pct >= 0 : true;
  const good = delta ? (delta.goodWhenUp ?? true) === up : true;

  const body = (
    <>
      <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent }} />
      <span style={{ color: '#6b7280', fontSize: '0.8125rem', fontWeight: 500 }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
          {value}
        </span>
        {delta && (
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10,
            background: good ? '#f0fdf4' : '#fef2f2',
            color: good ? '#15803d' : '#b91c1c',
            whiteSpace: 'nowrap',
          }}>
            {up ? '▲' : '▼'} {Math.abs(delta.pct)}%
          </span>
        )}
      </span>
      {/* Footer line: the delta's comparison basis AND the hint both render
          (joined with a dot) — a card can carry two reads, e.g. a "vs
          yesterday" pill plus a "vs last Thursday: …" baseline. */}
      {(spark && spark.length > 1) ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkline values={spark} color={accent} />
          {(delta?.vs || hint) && <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{[delta?.vs, hint].filter(Boolean).join(' · ')}</span>}
        </span>
      ) : (
        (delta?.vs || hint) && <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{[delta?.vs, hint].filter(Boolean).join(' · ')}</span>
      )}
    </>
  );

  const style: React.CSSProperties = {
    position: 'relative', overflow: 'hidden', background: 'white', borderRadius: 12,
    padding: '16px 18px', border: '1px solid #eef0f2', boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
    display: 'flex', flexDirection: 'column', gap: 6, textDecoration: 'none', color: 'inherit',
  };

  return href
    ? <Link href={href} className="adm-kpi-card" style={style}>{body}</Link>
    : <div className="adm-kpi-card" style={style}>{body}</div>;
}
