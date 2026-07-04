// Shared number/date tokens for the admin insight surfaces (Dashboard,
// Analytics, Finance). One module decides how money, counts, deltas and
// dates render so the pages can't drift apart. Money reuses the canonical
// finance formatter from lib/money.
export { fmtPKR } from '@/lib/money';
import { PK_TZ } from '@/lib/dates';

export const fmtInt = (n: number | string | null | undefined) =>
  Math.round(Number(n ?? 0) || 0).toLocaleString();

// Compact form for axis labels and sparkline captions: 950 → "950",
// 12,400 → "12.4k", 3,400,000 → "3.4M". Trailing ".0" is trimmed.
export const fmtCompact = (n: number): string => {
  const v = Math.abs(n);
  const s = (x: number) => {
    const r = x.toFixed(1);
    return r.endsWith('.0') ? r.slice(0, -2) : r;
  };
  const sign = n < 0 ? '-' : '';
  if (v >= 1_000_000) return `${sign}${s(v / 1_000_000)}M`;
  if (v >= 1_000) return `${sign}${s(v / 1_000)}k`;
  return `${sign}${Math.round(v)}`;
};

// The two date shapes used across insight surfaces: short for chart axes and
// dense rows ("3 Jul"), full for anything a person might quote ("3 Jul 2026").
export const fmtDateShort = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
    .toLocaleDateString('en-PK', { day: 'numeric', month: 'short', timeZone: PK_TZ });

export const fmtDateFull = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
    .toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', timeZone: PK_TZ });

// Period-over-period % change. Returns null whenever the comparison base is
// zero — a change from nothing has no percentage (it's not "+100%", which read
// as "doubled" on every fresh metric and made the dashboard look like a boom).
// Callers already suppress the delta pill on null, so no baseline → no pill,
// consistently on the dashboard and the Analytics tabs.
export const pctDelta = (cur: number, prev: number): number | null => {
  if (prev > 0) return Math.round(((cur - prev) / prev) * 100);
  return null;
};
