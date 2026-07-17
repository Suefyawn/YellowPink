'use client';

// Interactive layer of the Search-demand report. The server page assembles
// the data (see app/admin/search-demand/actions.ts) and this component turns
// it into the working surface: KPI tiles, a daily trend chart with crosshair
// and a table view, a demand-mix donut, rising/fading term lists, and the
// term tables with live filtering, momentum pills and hide controls.
//
// Chart conventions follow the admin dataviz kit: series colours validated
// for CVD separation, text always in ink (never the series colour), a legend
// whenever two series share a plot, and every chart has a table alternative.

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { KpiCard } from '@/components/admin/insights/KpiCard';
import { Sparkline } from '@/components/admin/insights/Sparkline';
import { fmtInt, fmtCompact, fmtDateShort, pctDelta } from '@/components/admin/insights/format';
import { SearchDemandExport } from '@/components/admin/SearchDemandExport';
import { ignoreSearchTerm, unignoreSearchTerm } from '@/app/admin/search-demand/ignore-actions';
import type { OnsiteRow, ConvRow, GscRow, RollupRow, DemandDay, DemandKpis, MoverRow } from '@/app/admin/search-demand/actions';

// ── palette (validated: lightness band, chroma, CVD ΔE, contrast) ──────────
const C_SEARCHES = '#2a78d6'; // trend line: total searches
const C_ZERO     = '#b91c1c'; // trend line + mix: zero-result (problem state)
const C_THIN     = '#d97706'; // mix: thin results
const C_HEALTHY  = '#059669'; // mix: healthy results
const C_MIX_GAP  = '#dc2626'; // mix donut red (slightly brighter for fills)

const INK = '#111827', INK2 = '#6b7280', INK3 = '#9ca3af', LINE = '#e5e7eb', LINE2 = '#f3f4f6';

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: INK2, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '9px 12px', fontSize: '0.8125rem', color: INK, borderBottom: `1px solid ${LINE2}`, verticalAlign: 'top' };
const num: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
const thRight: React.CSSProperties = { ...th, textAlign: 'right' };

interface Acts { product: boolean; guide: boolean }

const actBtn: React.CSSProperties = { fontSize: '0.6875rem', fontWeight: 600, padding: '3px 9px', borderRadius: 999, textDecoration: 'none', whiteSpace: 'nowrap', border: '1px solid transparent' };
const actProduct: React.CSSProperties = { ...actBtn, background: '#fdf2f8', color: '#9d174d', borderColor: '#fbcfe8' };
const actGuide: React.CSSProperties = { ...actBtn, background: '#f9fafb', color: '#374151', borderColor: LINE };
const actSynonym: React.CSSProperties = { ...actBtn, background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' };

function RowActions({ term, acts, guideOnly = false, synonym = false, onHide }: {
  term: string; acts: Acts; guideOnly?: boolean; synonym?: boolean; onHide?: (t: string) => void;
}) {
  const t = encodeURIComponent(term.slice(0, 120));
  return (
    <span style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
      {!guideOnly && acts.product && <Link href={`/admin/products/new?name=${t}`} style={actProduct}>+ Product</Link>}
      {acts.guide && <Link href={`/admin/blog/new?title=${t}`} style={actGuide}>+ Guide</Link>}
      {synonym && acts.product && <Link href={`/admin/search-demand?map=${t}#synonyms`} style={actSynonym}>+ Synonym</Link>}
      {onHide && acts.product && (
        <button
          type="button"
          onClick={() => onHide(term)}
          title="Hide this term from the report"
          aria-label={`Hide "${term}" from the report`}
          style={{ border: 'none', background: 'transparent', color: '#d1d5db', cursor: 'pointer', fontSize: '0.8125rem', lineHeight: 1, padding: 2 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = INK2; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#d1d5db'; }}
        >
          ✕
        </button>
      )}
    </span>
  );
}

function Card({ title, subtitle, right, children, id }: {
  title: string; subtitle: string; right?: React.ReactNode; children: React.ReactNode; id?: string;
}) {
  return (
    <section id={id} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden', marginBottom: 24, scrollMarginTop: 80 }}>
      <div style={{ padding: '16px 18px', borderBottom: `1px solid ${LINE2}`, display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: INK }}>{title}</h2>
          <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: INK2 }}>{subtitle}</p>
        </div>
        {right}
      </div>
      <div style={{ overflowX: 'auto' }}>{children}</div>
    </section>
  );
}

// Period-over-period momentum pill for a term row. "new" when there was no
// prior-window volume at all.
function MomentumPill({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0 && cur > 0) {
    return <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: '#eff6ff', color: '#1d4ed8' }}>new</span>;
  }
  const d = pctDelta(cur, prev);
  if (d === null || d === 0) return <span style={{ fontSize: '0.75rem', color: '#d1d5db' }}>—</span>;
  const up = d > 0;
  return (
    <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: up ? '#f0fdf4' : '#fef2f2', color: up ? '#15803d' : C_ZERO, whiteSpace: 'nowrap' }}>
      {up ? '▲' : '▼'} {Math.abs(d)}%
    </span>
  );
}

function resultBadge(results: number) {
  if (results === 0) return <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#fef2f2', color: C_ZERO, border: '1px solid #fecaca' }}>No results</span>;
  if (results > 0 && results <= 2) return <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>Only {results}</span>;
  if (results < 0) return <span style={{ fontSize: '0.75rem', color: INK3 }}>—</span>;
  return <span style={{ fontSize: '0.8125rem', color: C_HEALTHY }}>{results}+</span>;
}

// ── daily trend chart (line, crosshair, table toggle) ───────────────────────
const CH_W = 720, CH_H = 200, CH_PAD = { t: 12, r: 10, b: 24, l: 40 };

function TrendChart({ daily, hasZero }: { daily: DemandDay[]; hasZero: boolean }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hover, setHover] = useState<number | null>(null);

  const innerW = CH_W - CH_PAD.l - CH_PAD.r;
  const innerH = CH_H - CH_PAD.t - CH_PAD.b;
  const maxY = Math.max(1, ...daily.map(d => d.searches));
  const x = (i: number) => CH_PAD.l + (daily.length > 1 ? (i / (daily.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => CH_PAD.t + innerH - (v / maxY) * innerH;
  const path = (pick: (d: DemandDay) => number) =>
    daily.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(pick(d)).toFixed(1)}`).join(' ');

  // Sparse x ticks: first, last and ~3 between.
  const tickIdx = daily.length <= 5
    ? daily.map((_, i) => i)
    : [0, Math.round(daily.length * 0.25), Math.round(daily.length * 0.5), Math.round(daily.length * 0.75), daily.length - 1];

  if (daily.length === 0) {
    return <p style={{ padding: '18px', margin: 0, fontSize: '0.8125rem', color: INK3 }}>No on-site searches logged in this window yet.</p>;
  }

  return (
    <div style={{ padding: '14px 18px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: INK2 }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: C_SEARCHES }} /> Searches
        </span>
        {hasZero && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: INK2 }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: C_ZERO }} /> Found nothing
          </span>
        )}
        <button
          type="button"
          onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
          style={{ marginLeft: 'auto', border: `1px solid ${LINE}`, background: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 600, color: INK2, cursor: 'pointer' }}
        >
          {view === 'chart' ? 'View as table' : 'View as chart'}
        </button>
      </div>

      {view === 'table' ? (
        <div style={{ maxHeight: 260, overflowY: 'auto', border: `1px solid ${LINE2}`, borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Day</th>
              <th style={thRight}>Searches</th>
              <th style={thRight}>People</th>
              {hasZero && <th style={thRight}>Found nothing</th>}
            </tr></thead>
            <tbody>
              {[...daily].reverse().map(d => (
                <tr key={d.date}>
                  <td style={td}>{fmtDateShort(d.date)}</td>
                  <td style={num}>{fmtInt(d.searches)}</td>
                  <td style={num}>{fmtInt(d.people)}</td>
                  {hasZero && <td style={num}>{fmtInt(d.zero)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <svg
            viewBox={`0 0 ${CH_W} ${CH_H}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            role="img"
            aria-label="Daily on-site searches"
            onMouseMove={e => {
              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const px = ((e.clientX - rect.left) / rect.width) * CH_W;
              const i = Math.round(((px - CH_PAD.l) / innerW) * (daily.length - 1));
              setHover(i >= 0 && i < daily.length ? i : null);
            }}
            onMouseLeave={() => setHover(null)}
          >
            {/* recessive grid: 3 horizontal lines + y labels in ink */}
            {[0, 0.5, 1].map(f => {
              const gy = CH_PAD.t + innerH - f * innerH;
              return (
                <g key={f}>
                  <line x1={CH_PAD.l} x2={CH_W - CH_PAD.r} y1={gy} y2={gy} stroke={LINE2} strokeWidth={1} />
                  <text x={CH_PAD.l - 6} y={gy + 3.5} textAnchor="end" fontSize={10} fill={INK3}>{fmtCompact(maxY * f)}</text>
                </g>
              );
            })}
            {tickIdx.map(i => (
              <text key={i} x={x(i)} y={CH_H - 8} textAnchor="middle" fontSize={10} fill={INK3}>
                {fmtDateShort(daily[i].date)}
              </text>
            ))}
            {hasZero && <path d={path(d => d.zero)} fill="none" stroke={C_ZERO} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
            <path d={path(d => d.searches)} fill="none" stroke={C_SEARCHES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={CH_PAD.t} y2={CH_PAD.t + innerH} stroke={INK3} strokeWidth={1} strokeDasharray="3 3" />
                <circle cx={x(hover)} cy={y(daily[hover].searches)} r={4} fill={C_SEARCHES} stroke="#fff" strokeWidth={2} />
                {hasZero && <circle cx={x(hover)} cy={y(daily[hover].zero)} r={4} fill={C_ZERO} stroke="#fff" strokeWidth={2} />}
              </g>
            )}
          </svg>
          {hover !== null && (
            <div style={{
              position: 'absolute', top: 4,
              left: `${(x(hover) / CH_W) * 100}%`,
              transform: x(hover) > CH_W * 0.6 ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)',
              background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, boxShadow: '0 4px 12px rgba(16,24,40,0.08)',
              padding: '8px 10px', fontSize: '0.75rem', pointerEvents: 'none', whiteSpace: 'nowrap',
            }}>
              <div style={{ fontWeight: 700, color: INK, marginBottom: 3 }}>{fmtDateShort(daily[hover].date)}</div>
              <div style={{ color: INK2 }}>
                <span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C_SEARCHES, marginRight: 5 }} />
                {fmtInt(daily[hover].searches)} searches · {fmtInt(daily[hover].people)} people
              </div>
              {hasZero && (
                <div style={{ color: INK2 }}>
                  <span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C_ZERO, marginRight: 5 }} />
                  {fmtInt(daily[hover].zero)} found nothing
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── demand mix donut (share of search volume by result health) ──────────────
function MixDonut({ onsite }: { onsite: OnsiteRow[] }) {
  const gaps = onsite.filter(o => o.results === 0).reduce((s, o) => s + o.searches, 0);
  const thin = onsite.filter(o => o.results > 0 && o.results <= 2).reduce((s, o) => s + o.searches, 0);
  const healthy = onsite.filter(o => o.results > 2).reduce((s, o) => s + o.searches, 0);
  const total = gaps + thin + healthy;
  const segs = [
    { label: 'Found nothing', value: gaps, color: C_MIX_GAP },
    { label: 'Thin (1–2 products)', value: thin, color: C_THIN },
    { label: 'Healthy (3+)', value: healthy, color: C_HEALTHY },
  ].filter(s => s.value > 0);

  if (total === 0) {
    return <p style={{ padding: 18, margin: 0, fontSize: '0.8125rem', color: INK3 }}>No search volume in this window yet.</p>;
  }

  const R = 52, CIRC = 2 * Math.PI * R, GAP = segs.length > 1 ? 2 : 0;
  const offsets = segs.reduce<number[]>((acc, _s, i) => {
    if (i === 0) return [0];
    return [...acc, acc[i - 1] + (segs[i - 1].value / total) * CIRC];
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 18px', flexWrap: 'wrap' }}>
      <svg width={140} height={140} viewBox="0 0 140 140" role="img" aria-label="Share of search volume by result health">
        <g transform="rotate(-90 70 70)">
          {segs.map((s, i) => (
            <circle
              key={s.label}
              cx={70} cy={70} r={R} fill="none"
              stroke={s.color} strokeWidth={18}
              strokeDasharray={`${Math.max(0, (s.value / total) * CIRC - GAP)} ${CIRC}`}
              strokeDashoffset={-offsets[i] - (i === 0 ? 0 : GAP / 2)}
            >
              <title>{`${s.label}: ${fmtInt(s.value)} searches (${Math.round((s.value / total) * 100)}%)`}</title>
            </circle>
          ))}
        </g>
        <text x={70} y={66} textAnchor="middle" fontSize={20} fontWeight={700} fill={INK}>{fmtCompact(total)}</text>
        <text x={70} y={82} textAnchor="middle" fontSize={10} fill={INK2}>searches</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
        {segs.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: INK }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{s.label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtInt(s.value)}</span>
            <span style={{ color: INK3, fontVariantNumeric: 'tabular-nums', width: 38, textAlign: 'right' }}>{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── rising / fading term lists ───────────────────────────────────────────────
function MoversList({ rows, dir }: { rows: OnsiteRow[]; dir: 'up' | 'down' }) {
  if (rows.length === 0) {
    return <p style={{ padding: '14px 18px', margin: 0, fontSize: '0.8125rem', color: INK3 }}>
      {dir === 'up' ? 'Nothing clearly rising yet.' : 'Nothing clearly fading.'}
    </p>;
  }
  return (
    <div style={{ padding: '8px 6px' }}>
      {rows.map(r => (
        <div key={r.query} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: '0.8125rem', color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.query}</span>
          {r.spark.some(v => v > 0) && <Sparkline values={r.spark} color={dir === 'up' ? C_HEALTHY : C_ZERO} />}
          <span style={{ fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums', color: INK2, width: 34, textAlign: 'right' }}>{fmtInt(r.searches)}</span>
          <MomentumPill cur={r.searches} prev={r.prev} />
        </div>
      ))}
    </div>
  );
}

// ── rollup horizontal micro-bars ────────────────────────────────────────────
function RollupBars({ rows, label }: { rows: RollupRow[]; label: string }) {
  const max = Math.max(1, ...rows.map(r => r.searches));
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 300 }}>
      <thead><tr>
        <th style={th}>{label}</th>
        <th style={{ ...th, width: '40%' }}></th>
        <th style={thRight}>Searches</th>
        <th style={thRight}>Terms</th>
      </tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.name}>
            <td style={td}>{r.name}</td>
            <td style={{ ...td, verticalAlign: 'middle' }}>
              <span aria-hidden="true" style={{ display: 'block', height: 8, borderRadius: 4, background: C_SEARCHES, width: `${Math.max(3, (r.searches / max) * 100)}%`, opacity: 0.85 }} />
            </td>
            <td style={num}>{fmtInt(r.searches)}</td>
            <td style={num}>{fmtInt(r.terms)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── sortable on-site table ──────────────────────────────────────────────────
type SortKey = 'searches' | 'people' | 'momentum' | 'results';

function SortTh({ k, sortKey, desc, onSort, children }: {
  k: SortKey; sortKey: SortKey; desc: boolean; onSort: (k: SortKey) => void; children: React.ReactNode;
}) {
  return (
    <th
      style={{ ...thRight, cursor: 'pointer', userSelect: 'none' }}
      onClick={() => onSort(k)}
      aria-sort={sortKey === k ? (desc ? 'descending' : 'ascending') : undefined}
    >
      {children}{sortKey === k ? (desc ? ' ↓' : ' ↑') : ''}
    </th>
  );
}

function OnsiteTable({ rows, acts, withSynonym = false, onHide }: {
  rows: OnsiteRow[]; acts: Acts; withSynonym?: boolean; onHide?: (t: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('searches');
  const [desc, setDesc] = useState(true);
  const showActs = acts.product || acts.guide;

  const sorted = useMemo(() => {
    const v = (r: OnsiteRow): number =>
      sortKey === 'searches' ? r.searches
      : sortKey === 'people' ? r.people
      : sortKey === 'results' ? r.results
      : (r.prev === 0 ? (r.searches > 0 ? Number.MAX_SAFE_INTEGER : 0) : (r.searches - r.prev) / r.prev);
    return [...rows].sort((a, b) => (desc ? v(b) - v(a) : v(a) - v(b)));
  }, [rows, sortKey, desc]);

  const onSort = (k: SortKey) => { if (sortKey === k) setDesc(!desc); else { setSortKey(k); setDesc(true); } };
  const sortProps = { sortKey, desc, onSort };

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
      <thead><tr>
        <th style={th}>What they typed</th>
        <SortTh k="searches" {...sortProps}>Searches</SortTh>
        <SortTh k="people" {...sortProps}>People</SortTh>
        <SortTh k="momentum" {...sortProps}>vs prev</SortTh>
        <th style={th}>Trend</th>
        <SortTh k="results" {...sortProps}>Products shown</SortTh>
        {showActs && <th style={thRight}>Act</th>}
      </tr></thead>
      <tbody>
        {sorted.map(r => (
          <tr key={r.query}>
            <td style={td}>{r.query}</td>
            <td style={num}>{fmtInt(r.searches)}</td>
            <td style={num}>{fmtInt(r.people)}</td>
            <td style={{ ...num }}><MomentumPill cur={r.searches} prev={r.prev} /></td>
            <td style={{ ...td, width: 72 }}>
              {r.spark.some(v => v > 0) ? <Sparkline values={r.spark} color="#C5286A" /> : <span style={{ color: '#d1d5db' }}>—</span>}
            </td>
            <td style={num}>{resultBadge(r.results)}</td>
            {showActs && <td style={num}><RowActions term={r.query} acts={acts} synonym={withSynonym} onHide={onHide} /></td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }
function pctRate(n: number) { return `${Math.round(n * 100)}%`; }

function GscTable({ rows, acts }: { rows: GscRow[]; acts: Acts }) {
  const showActs = acts.guide; // GSC demand feeds guides, not new products
  const maxImp = Math.max(1, ...rows.map(r => r.impressions));
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
      <thead><tr>
        <th style={th}>Search term</th>
        <th style={thRight}>Impressions</th>
        <th style={{ ...th, width: '18%' }}></th>
        <th style={thRight}>Position</th>
        <th style={thRight}>Clicks</th>
        <th style={thRight}>CTR</th>
        {showActs && <th style={thRight}>Act</th>}
      </tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={td}>{r.query}</td>
            <td style={num}>{fmtInt(r.impressions)}</td>
            <td style={{ ...td, verticalAlign: 'middle' }}>
              <span aria-hidden="true" style={{ display: 'block', height: 8, borderRadius: 4, background: C_SEARCHES, width: `${Math.max(3, (r.impressions / maxImp) * 100)}%`, opacity: 0.85 }} />
            </td>
            <td style={num}>{r.position.toFixed(1)}</td>
            <td style={num}>{fmtInt(r.clicks)}</td>
            <td style={num}>{pct(r.ctr)}</td>
            {showActs && <td style={num}><RowActions term={r.query} acts={acts} guideOnly /></td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ConvTable({ rows }: { rows: ConvRow[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
      <thead><tr>
        <th style={th}>What they typed</th>
        <th style={thRight}>Searchers</th>
        <th style={thRight}>Went on to buy</th>
        <th style={thRight}>Buy-through</th>
        <th style={thRight}>Products shown</th>
      </tr></thead>
      <tbody>
        {rows.map((r, i) => {
          const rate = r.searchers ? r.buyers / r.searchers : 0;
          return (
            <tr key={i}>
              <td style={td}>{r.query}</td>
              <td style={num}>{fmtInt(r.searchers)}</td>
              <td style={num}>{fmtInt(r.buyers)}</td>
              <td style={{ ...num, color: rate < 0.1 ? C_ZERO : rate < 0.25 ? '#b45309' : C_HEALTHY, fontWeight: 700 }}>{pctRate(rate)}</td>
              <td style={num}>{r.results}+</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function GscMoversTable({ rows, dir }: { rows: MoverRow[]; dir: 'up' | 'down' }) {
  if (rows.length === 0) {
    return <p style={{ padding: '14px 18px', margin: 0, fontSize: '0.8125rem', color: INK3 }}>
      {dir === 'up' ? 'No clear gainers between the last two snapshots.' : 'No clear losers. Good.'}
    </p>;
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 320 }}>
      <thead><tr>
        <th style={th}>Query</th>
        <th style={thRight}>Position</th>
        <th style={thRight}>Impressions</th>
      </tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.query}>
            <td style={td}>{r.query}</td>
            <td style={num}>
              <span style={{ color: INK3 }}>{r.prevPosition.toFixed(1)} → </span>
              <span style={{ fontWeight: 700, color: dir === 'up' ? C_HEALTHY : C_ZERO }}>{r.position.toFixed(1)}</span>
            </td>
            <td style={num}>{fmtInt(r.impressions)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── the dashboard ───────────────────────────────────────────────────────────
export interface SearchDemandDashboardProps {
  onsite: OnsiteRow[];
  nonConverting: ConvRow[];
  winnable: GscRow[];
  lowCtr: GscRow[];
  brandDemand: RollupRow[];
  categoryDemand: RollupRow[];
  daily: DemandDay[];
  hasResultCounts: boolean;
  kpis: DemandKpis;
  moversUp: MoverRow[];
  moversDown: MoverRow[];
  moverHistoryDays: number;
  ignored: string[];
  acts: Acts;
  days: number;
  gscUpdatedAt: string | null;
  posthogConnected: boolean;
  /** Server-rendered synonym manager card body (permission-gated upstream). */
  synonymsSlot?: React.ReactNode;
}

export function SearchDemandDashboard(p: SearchDemandDashboardProps) {
  const [filter, setFilter] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [, startTransition] = useTransition();

  const hide = (term: string) => {
    if (!window.confirm(`Hide "${term}" from this report? You can un-hide it from the Hidden terms list.`)) return;
    startTransition(() => { void ignoreSearchTerm(term); });
  };
  const unhide = (term: string) => startTransition(() => { void unignoreSearchTerm(term); });

  const f = filter.trim().toLowerCase();
  const match = (q: string) => !f || q.toLowerCase().includes(f);
  const onsite = p.onsite.filter(o => match(o.query));
  const gaps = onsite.filter(r => r.results === 0).sort((a, b) => b.searches - a.searches);
  const thin = onsite.filter(r => r.results > 0 && r.results <= 2).sort((a, b) => b.searches - a.searches);
  const healthy = onsite.filter(r => r.results > 2 || r.results < 0).sort((a, b) => b.searches - a.searches);
  const nonConverting = p.nonConverting.filter(r => match(r.query));
  const winnable = p.winnable.filter(r => match(r.query));
  const lowCtr = p.lowCtr.filter(r => match(r.query));

  // Rising / fading: real prior volume both sides, meaningful change.
  const rising = p.onsite
    .filter(o => o.searches >= 2 && (o.prev === 0 || o.searches >= o.prev * 1.5))
    .sort((a, b) => (b.searches - b.prev) - (a.searches - a.prev))
    .slice(0, 8);
  const fading = p.onsite
    .filter(o => o.prev >= 3 && o.searches <= o.prev * 0.6)
    .sort((a, b) => (b.prev - b.searches) - (a.prev - a.searches))
    .slice(0, 8);

  const searchesDelta = pctDelta(p.kpis.searches, p.kpis.prevSearches);
  const peopleDelta = pctDelta(p.kpis.people, p.kpis.prevPeople);
  const btDelta = (p.kpis.buyThrough !== null && p.kpis.prevBuyThrough !== null && p.kpis.prevBuyThrough > 0)
    ? Math.round(((p.kpis.buyThrough - p.kpis.prevBuyThrough) / p.kpis.prevBuyThrough) * 100)
    : null;

  return (
    <>
      {/* ── controls: filter + hidden-terms manager ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          type="search"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter terms…"
          aria-label="Filter all term lists"
          style={{ padding: '7px 12px', border: `1px solid ${LINE}`, borderRadius: '8px', fontSize: '0.8125rem', width: '200px' }}
        />
        {p.acts.product && p.ignored.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHidden(!showHidden)}
            style={{ border: `1px solid ${LINE}`, background: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: '0.8125rem', fontWeight: 600, color: INK2, cursor: 'pointer' }}
          >
            Hidden terms ({p.ignored.length})
          </button>
        )}
        <span style={{ marginLeft: 'auto' }}>
          <SearchDemandExport rows={p.onsite} days={p.days} />
        </span>
      </div>

      {showHidden && p.ignored.length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: INK2, marginRight: 4 }}>Hidden from the report:</span>
          {p.ignored.map(t => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', background: '#f9fafb', border: `1px solid ${LINE}`, borderRadius: 999, padding: '3px 10px', color: INK }}>
              {t}
              <button type="button" onClick={() => unhide(t)} title="Un-hide" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: INK2, fontSize: '0.75rem', padding: 0 }}>↩</button>
            </span>
          ))}
        </div>
      )}

      {/* ── KPI row ── */}
      {p.posthogConnected && (
        <div className="adm-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
          <KpiCard
            label="On-site searches"
            value={fmtInt(p.kpis.searches)}
            accent={C_SEARCHES}
            delta={searchesDelta !== null ? { pct: searchesDelta, vs: `vs prev ${p.days}d` } : null}
            spark={p.daily.map(d => d.searches)}
          />
          <KpiCard
            label="People searching"
            value={fmtInt(p.kpis.people)}
            accent="#C5286A"
            delta={peopleDelta !== null ? { pct: peopleDelta, vs: `vs prev ${p.days}d` } : null}
            spark={p.daily.map(d => d.people)}
          />
          <KpiCard
            label="Demand finding nothing"
            value={pctRate(p.kpis.zeroShare)}
            accent={C_MIX_GAP}
            hint="share of search volume with zero products"
          />
          <KpiCard
            label="Searcher buy-through"
            value={p.kpis.buyThrough !== null ? pctRate(p.kpis.buyThrough) : '—'}
            accent={C_HEALTHY}
            delta={btDelta !== null ? { pct: btDelta, vs: `vs prev ${p.days}d` } : null}
            hint={btDelta === null ? 'searchers who purchased in the window' : undefined}
          />
        </div>
      )}

      {/* ── trend + mix ── */}
      {p.posthogConnected && (
        <Card
          title="Search activity"
          subtitle={`Daily on-site searches over the last ${p.days} days.${p.hasResultCounts ? ' The red line is searches that found zero products.' : ''}`}
        >
          <TrendChart daily={p.daily} hasZero={p.hasResultCounts} />
        </Card>
      )}

      {p.posthogConnected && p.onsite.length > 0 && (
        <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 24 }}>
          <section style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', borderBottom: `1px solid ${LINE2}` }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: INK }}>Where demand lands</h2>
              <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: INK2 }}>Share of search volume by what the shopper saw.</p>
            </div>
            <MixDonut onsite={p.onsite} />
          </section>
          <section style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', borderBottom: `1px solid ${LINE2}` }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: INK }}>Rising searches</h2>
              <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: INK2 }}>Growing vs the previous {p.days} days — demand to get ahead of.</p>
            </div>
            <MoversList rows={rising} dir="up" />
            {fading.length > 0 && (
              <>
                <div style={{ padding: '10px 18px 4px', borderTop: `1px solid ${LINE2}` }}>
                  <h3 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: INK2 }}>Fading</h3>
                </div>
                <MoversList rows={fading} dir="down" />
              </>
            )}
          </section>
        </div>
      )}

      {/* ── gaps ── */}
      <Card
        title="On-site searches with no results"
        subtitle="People searched your site for these and saw nothing. Each is a product to stock, a page to create, or a naming mismatch to map with a synonym."
      >
        {gaps.length > 0
          ? <OnsiteTable rows={gaps} acts={p.acts} withSynonym onHide={p.acts.product ? hide : undefined} />
          : <p style={{ padding: 18, margin: 0, fontSize: '0.8125rem', color: INK3 }}>
              {f ? 'No zero-result searches match the filter.' : `No zero-result searches in the last ${p.days} days. Nice.`}
            </p>}
      </Card>

      {/* ── synonyms slot (server-gated) ── */}
      {p.synonymsSlot}

      {thin.length > 0 && (
        <Card
          title="On-site searches with thin results"
          subtitle="Only one or two products matched. Worth adding depth to the range or checking the product naming."
        >
          <OnsiteTable rows={thin} acts={p.acts} withSynonym onHide={p.acts.product ? hide : undefined} />
        </Card>
      )}

      {nonConverting.length > 0 && (
        <Card
          title="Searched, shown products, but rarely bought"
          subtitle="These searches DO return products, but few of the people searching them go on to buy anything. Often a price, imagery, stock or trust problem on the products they land on. Buy-through = share of searchers who purchased within the window (a cohort estimate, not per-item attribution)."
        >
          <ConvTable rows={nonConverting} />
        </Card>
      )}

      {(p.brandDemand.length > 0 || p.categoryDemand.length > 0) && (
        <Card
          title="Demand by brand & category"
          subtitle="On-site searches rolled up to the brands and categories you stock, so you can see which ranges shoppers hunt for by name — worth featuring, restocking or expanding."
        >
          <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 0 }}>
            <div style={{ overflowX: 'auto', borderRight: `1px solid ${LINE2}` }}>
              {p.brandDemand.length > 0 ? <RollupBars rows={p.brandDemand} label="Brand" /> : <p style={{ padding: 18, margin: 0, fontSize: '0.8125rem', color: INK3 }}>No brand-name searches yet.</p>}
            </div>
            <div style={{ overflowX: 'auto' }}>
              {p.categoryDemand.length > 0 ? <RollupBars rows={p.categoryDemand} label="Category" /> : <p style={{ padding: 18, margin: 0, fontSize: '0.8125rem', color: INK3 }}>No category searches yet.</p>}
            </div>
          </div>
        </Card>
      )}

      {/* ── Google ── */}
      <Card
        title="Google: winnable queries (page 2–4)"
        subtitle="You already rank for these but off page 1. A content or internal-link push can move them up."
      >
        {winnable.length > 0 ? <GscTable rows={winnable} acts={p.acts} /> : <p style={{ padding: 18, margin: 0, fontSize: '0.8125rem', color: INK3 }}>{f ? 'No winnable queries match the filter.' : 'No Search Console data cached yet.'}</p>}
      </Card>

      {(p.moverHistoryDays >= 2 || p.moversUp.length > 0 || p.moversDown.length > 0) ? (
        <Card
          title="Google: movers this week"
          subtitle="Queries whose ranking moved between the last two weekly snapshots. Gainers show content that Google is warming to; losers may need a refresh."
        >
          <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 0 }}>
            <div style={{ overflowX: 'auto', borderRight: `1px solid ${LINE2}` }}>
              <div style={{ padding: '10px 18px 0' }}><h3 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: C_HEALTHY }}>Gaining</h3></div>
              <GscMoversTable rows={p.moversUp} dir="up" />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ padding: '10px 18px 0' }}><h3 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: C_ZERO }}>Slipping</h3></div>
              <GscMoversTable rows={p.moversDown} dir="down" />
            </div>
          </div>
        </Card>
      ) : (
        <p style={{ fontSize: '0.75rem', color: INK3, margin: '0 0 24px' }}>
          Google movers (rising / falling queries) appear here once a few days of ranking history accumulate — collection started with this update.
        </p>
      )}

      {lowCtr.length > 0 && (
        <Card
          title="Google: ranking well but few clicks"
          subtitle="On page 1 with a low click-through rate — usually a title / description that isn't selling the click."
        >
          <GscTable rows={lowCtr} acts={p.acts} />
        </Card>
      )}

      {healthy.length > 0 && (
        <Card
          title="On-site: top searches"
          subtitle="Your most-searched terms overall (results look healthy)."
        >
          <OnsiteTable rows={healthy.slice(0, 20)} acts={{ product: false, guide: false }} onHide={p.acts.product ? hide : undefined} />
        </Card>
      )}
    </>
  );
}
