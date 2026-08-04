'use client';

// Interactive layer of /admin/seo-rankings: search, position-bucket filters,
// sortable columns, per-keyword GSC position sparklines, add/untrack keyword
// actions, and the untracked-opportunities list. All data arrives prepared
// from the server component; this file only filters/sorts/renders it.

import { useMemo, useState, useTransition } from 'react';
import { trackKeyword, untrackKeyword } from '@/app/admin/seo-rankings/actions';

export interface KeywordRow {
  keyword: string;
  volume: number | null;
  /** Semrush PK position, latest batch. null = not in top 100. */
  position: number | null;
  prevPosition: number | null;
  /** true when the keyword appears in the latest Semrush batch at all. */
  inLatestBatch: boolean;
  url: string | null;
  /** GSC 28-day aggregates (null when Google served no impressions). */
  gscPosition: number | null;
  clicks: number | null;
  impressions: number | null;
  /** Daily GSC positions, oldest→newest, null-padded days omitted. */
  spark: { day: string; position: number }[];
}

export interface Opportunity {
  query: string;
  clicks: number;
  impressions: number;
  position: number | null;
}

type Bucket = 'all' | 'top3' | 'page1' | 'page2' | 'beyond' | 'unranked';
type SortKey = 'volume' | 'position' | 'movement' | 'clicks' | 'impressions';

const BUCKETS: { key: Bucket; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'top3', label: 'Top 3' },
  { key: 'page1', label: 'Page 1' },
  { key: 'page2', label: 'Page 2' },
  { key: 'beyond', label: '21–100' },
  { key: 'unranked', label: 'Not in top 100' },
];

function bucketOf(r: KeywordRow): Exclude<Bucket, 'all'> {
  if (r.position == null) return 'unranked';
  if (r.position <= 3) return 'top3';
  if (r.position <= 10) return 'page1';
  if (r.position <= 20) return 'page2';
  return 'beyond';
}

function movementOf(r: KeywordRow): number | null {
  if (r.position == null || r.prevPosition == null) return null;
  return Math.round(r.prevPosition - r.position); // positive = climbed
}

// Inverted-y sparkline (position 1 sits at the top). Single series, so no
// legend; a <title> carries the exact range for hover/screen readers.
function Sparkline({ spark }: { spark: KeywordRow['spark'] }) {
  if (spark.length < 2) {
    return <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>{spark.length === 1 ? `pos ${spark[0].position.toFixed(0)}` : '—'}</span>;
  }
  const w = 120, h = 28, pad = 3;
  const ps = spark.map(s => s.position);
  const min = Math.min(...ps), max = Math.max(...ps);
  const span = Math.max(max - min, 1);
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (spark.length - 1);
  const y = (p: number) => pad + ((p - min) * (h - 2 * pad)) / span; // low pos (good) → top
  const points = spark.map((s, i) => `${x(i).toFixed(1)},${y(s.position).toFixed(1)}`).join(' ');
  const last = spark[spark.length - 1];
  const improving = spark[0].position - last.position;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" style={{ display: 'block' }}>
      <title>{`Google position, last ${spark.length} days: ${spark[0].position.toFixed(1)} → ${last.position.toFixed(1)} (best ${min.toFixed(1)}, worst ${max.toFixed(1)})`}</title>
      <polyline
        points={points}
        fill="none"
        stroke={improving >= 0 ? '#15803d' : '#b91c1c'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(spark.length - 1)} cy={y(last.position)} r="2.5" fill={improving >= 0 ? '#15803d' : '#b91c1c'} />
    </svg>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '9px 10px', fontSize: '0.8125rem', color: '#111827', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' };
const num: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

export function SeoRankingsClient({ rows, opportunities }: { rows: KeywordRow[]; opportunities: Opportunity[] }) {
  const [q, setQ] = useState('');
  const [bucket, setBucket] = useState<Bucket>('all');
  const [sort, setSort] = useState<SortKey>('volume');
  const [newKeyword, setNewKeyword] = useState('');
  const [formError, setFormError] = useState('');
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { all: rows.length, top3: 0, page1: 0, page2: 0, beyond: 0, unranked: 0 };
    for (const r of rows) c[bucketOf(r)]++;
    return c;
  }, [rows]);

  const view = useMemo(() => {
    const needle = q.toLowerCase().trim();
    const filtered = rows.filter(r =>
      (bucket === 'all' || bucketOf(r) === bucket) &&
      (!needle || r.keyword.includes(needle) || (r.url ?? '').toLowerCase().includes(needle)),
    );
    const nullLast = (v: number | null) => (v == null ? Number.POSITIVE_INFINITY : v);
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'position': return nullLast(a.position) - nullLast(b.position);
        case 'movement': return (movementOf(b) ?? Number.NEGATIVE_INFINITY) - (movementOf(a) ?? Number.NEGATIVE_INFINITY);
        case 'clicks': return (b.clicks ?? 0) - (a.clicks ?? 0);
        case 'impressions': return (b.impressions ?? 0) - (a.impressions ?? 0);
        default: return (b.volume ?? 0) - (a.volume ?? 0);
      }
    });
  }, [rows, q, bucket, sort]);

  function submitTrack(keyword: string) {
    setFormError('');
    const fd = new FormData();
    fd.set('keyword', keyword);
    startTransition(async () => {
      const res = await trackKeyword(fd);
      if (!res.ok) setFormError(res.error ?? 'Could not add keyword.');
      else setNewKeyword('');
    });
  }

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '5px 11px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
    border: `1px solid ${active ? '#be185d' : '#e5e7eb'}`,
    background: active ? '#fdf2f8' : '#fff',
    color: active ? '#be185d' : '#374151',
  });

  return (
    <>
      {/* Controls: one row above the table (search, buckets, sort, add). */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search keyword or page…"
          style={{ padding: '7px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.8125rem', width: 220 }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {BUCKETS.map(b => (
            <button key={b.key} type="button" style={chip(bucket === b.key)} onClick={() => setBucket(b.key)}>
              {b.label} ({counts[b.key]})
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          style={{ padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.8125rem', marginLeft: 'auto' }}
        >
          <option value="volume">Sort: search volume</option>
          <option value="position">Sort: best position</option>
          <option value="movement">Sort: biggest movers</option>
          <option value="clicks">Sort: clicks (28d)</option>
          <option value="impressions">Sort: impressions (28d)</option>
        </select>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr>
                <th style={th}>Keyword</th>
                <th style={{ ...th, ...num }}>Searches / mo</th>
                <th style={{ ...th, ...num }}>Semrush pos</th>
                <th style={{ ...th, ...num }}>Change</th>
                <th style={{ ...th, ...num }}>Google pos (28d)</th>
                <th style={{ ...th, ...num }}>Clicks</th>
                <th style={th}>Trend (GSC daily)</th>
                <th style={th} aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {view.map(r => {
                const mv = movementOf(r);
                const mvLabel = !r.inLatestBatch ? 'awaiting check'
                  : mv == null ? (r.position != null && r.prevPosition == null ? 'new' : '—')
                  : mv === 0 ? '='
                  : mv > 0 ? `▲ ${mv}` : `▼ ${-mv}`;
                const mvColor = mv == null ? '#9ca3af' : mv > 0 ? '#15803d' : mv < 0 ? '#b91c1c' : '#6b7280';
                return (
                  <tr key={r.keyword}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {r.keyword}
                      {r.url && (
                        <div style={{ fontWeight: 400, fontSize: '0.6875rem', color: '#6b7280', overflowWrap: 'anywhere' }}>{r.url}</div>
                      )}
                    </td>
                    <td style={{ ...td, ...num }}>{r.volume?.toLocaleString() ?? '—'}</td>
                    <td style={{ ...td, ...num, fontWeight: 700, color: r.position != null && r.position <= 10 ? '#15803d' : '#111827' }}>
                      {r.position != null ? Math.round(r.position) : r.inLatestBatch ? '>100' : '—'}
                    </td>
                    <td style={{ ...td, ...num, color: mvColor, fontWeight: 600, fontSize: '0.75rem' }}>{mvLabel}</td>
                    <td style={{ ...td, ...num }}>{r.gscPosition != null ? r.gscPosition.toFixed(1) : '—'}</td>
                    <td style={{ ...td, ...num }}>{r.clicks?.toLocaleString() ?? '—'}</td>
                    <td style={td}><Sparkline spark={r.spark} /></td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button
                        type="button"
                        title="Stop tracking this keyword"
                        onClick={() => startTransition(() => untrackKeyword(r.keyword).then(() => undefined))}
                        disabled={pending}
                        style={{ border: 'none', background: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.875rem', padding: 4 }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
              {view.length === 0 && (
                <tr><td style={{ ...td, color: '#6b7280' }} colSpan={8}>No keywords match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add keyword */}
      <form
        onSubmit={e => { e.preventDefault(); submitTrack(newKeyword); }}
        style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}
      >
        <input
          value={newKeyword}
          onChange={e => setNewKeyword(e.target.value)}
          placeholder="Track a new keyword (e.g. jenpharm sunblock)"
          style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.8125rem', width: 300 }}
        />
        <button
          type="submit"
          disabled={pending || newKeyword.trim().length < 2}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#be185d', color: '#fff', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', opacity: pending ? 0.6 : 1 }}
        >
          {pending ? 'Saving…' : 'Track keyword'}
        </button>
        <span style={{ fontSize: '0.75rem', color: formError ? '#b91c1c' : '#6b7280' }}>
          {formError || 'Position and volume fill in on the next scheduled check (1st / 15th); Google data appears as soon as the query has impressions.'}
        </span>
      </form>

      {/* Opportunities: queries Google already shows us for, not yet tracked. */}
      {opportunities.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Untracked queries Google already shows you for</h2>
          <p style={{ margin: '0 0 12px', fontSize: '0.75rem', color: '#6b7280', maxWidth: 640 }}>
            From Search Console, last 28 days, sorted by impressions. These earned impressions without being on the tracked list; one click adds them to the twice-monthly check.
          </p>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr>
                    <th style={th}>Query</th>
                    <th style={{ ...th, ...num }}>Impressions</th>
                    <th style={{ ...th, ...num }}>Clicks</th>
                    <th style={{ ...th, ...num }}>Position</th>
                    <th style={th} aria-label="actions" />
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map(o => (
                    <tr key={o.query}>
                      <td style={{ ...td, fontWeight: 600 }}>{o.query}</td>
                      <td style={{ ...td, ...num }}>{o.impressions.toLocaleString()}</td>
                      <td style={{ ...td, ...num }}>{o.clicks.toLocaleString()}</td>
                      <td style={{ ...td, ...num }}>{o.position != null ? o.position.toFixed(1) : '—'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => submitTrack(o.query)}
                          disabled={pending}
                          style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #be185d', background: '#fff', color: '#be185d', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Track
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
