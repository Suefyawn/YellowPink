'use client';

import type { OnsiteRow } from '@/app/admin/search-demand/actions';

// Client-side CSV export of the on-site demand list — the procurement view.
// Everything is already on the page, so we build the file in the browser
// (no extra request) and trigger a download.

function trendLabel(spark: number[]): string {
  if (!spark || spark.length < 2) return '';
  const half = Math.floor(spark.length / 2);
  const first = spark.slice(0, half).reduce((a, b) => a + b, 0) / Math.max(1, half);
  const second = spark.slice(half).reduce((a, b) => a + b, 0) / Math.max(1, spark.length - half);
  if (second > first * 1.2) return 'rising';
  if (second < first * 0.8) return 'falling';
  return 'steady';
}

function toCsv(rows: OnsiteRow[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Search term', 'Searches', 'People', 'Products shown', 'Trend'];
  const body = rows.map(r => [
    r.query, r.searches, r.people,
    r.results < 0 ? 'unknown' : r.results,
    trendLabel(r.spark),
  ].map(esc).join(','));
  return [header.join(','), ...body].join('\n');
}

export function SearchDemandExport({ rows, days }: { rows: OnsiteRow[]; days: number }) {
  const download = () => {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-demand-${days}d.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      type="button"
      onClick={download}
      disabled={rows.length === 0}
      style={{
        padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff',
        fontSize: '0.8125rem', fontWeight: 600, color: rows.length ? '#374151' : '#9ca3af',
        cursor: rows.length ? 'pointer' : 'default', whiteSpace: 'nowrap',
      }}
    >
      Export CSV
    </button>
  );
}
