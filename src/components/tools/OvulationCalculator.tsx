'use client';

// Interactive ovulation / fertile-window calculator. Pure client-side date
// math, no network calls: results render instantly and nothing personal
// leaves the browser. Assumes ovulation ~14 days before the NEXT period
// (luteal phase length), which holds across cycle lengths far better than
// "day 14 from the last period" does on long or short cycles.

import { useMemo, useState } from 'react';
import posthog from 'posthog-js';

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function fmt(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' });
}

interface Result {
  fertileStart: Date;
  fertileEnd: Date;
  ovulation: Date;
  nextPeriod: Date;
  testFrom: Date;
  /** Cycle-strip geometry, frozen at calculation time (1-based day numbers). */
  cycleLen: number;
  fertileFromDay: number;
  fertileToDay: number;
  ovulationDay: number;
}

// The month at a glance: period days, the fertile window and ovulation as a
// labelled strip across the cycle. Colour never stands alone — the legend
// names each segment.
function CycleStrip({ r }: { r: Result }) {
  const days = Array.from({ length: r.cycleLen }, (_, i) => i + 1);
  const kind = (d: number) =>
    d === r.ovulationDay ? 'ovulation'
    : d >= r.fertileFromDay && d <= r.fertileToDay ? 'fertile'
    : d <= 5 ? 'period'
    : 'rest';
  const bg = { period: '#fde3e3', fertile: '#dcfce7', ovulation: '#15803d', rest: 'var(--paper2, #faf6ee)' } as const;
  return (
    <div style={{ margin: '0 0 18px' }}>
      <div style={{ display: 'flex', gap: 2, height: 26, borderRadius: 6, overflow: 'hidden' }}>
        {days.map(d => (
          <span key={d} title={`Day ${d}`} style={{ flex: 1, background: bg[kind(d)], minWidth: 0 }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
        {[
          { swatch: bg.period, label: 'Period (approx.)' },
          { swatch: bg.fertile, label: `Fertile days ${r.fertileFromDay}–${r.fertileToDay}` },
          { swatch: bg.ovulation, label: `Ovulation day ${r.ovulationDay}` },
        ].map(l => (
          <span key={l.label} className="small-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-700)' }}>
            <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 3, background: l.swatch, border: '1px solid rgba(0,0,0,0.08)' }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Usage analytics for the admin Quick Answers panel: one event per completed
// calculation, no personal values attached.
function captureUse(answer: string) {
  try { posthog.capture('answer_used', { answer }); } catch { /* posthog not ready */ }
}

export function OvulationCalculator() {
  const [lmp, setLmp] = useState('');
  const [cycleLength, setCycleLength] = useState(28);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  // Date inputs cap at today: a future "last period" makes no sense.
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  function calculate() {
    setError('');
    const start = new Date(`${lmp}T00:00:00`);
    if (!lmp || Number.isNaN(start.getTime())) {
      setError('Pick the first day of your last period.');
      setResult(null);
      return;
    }
    if (start.getTime() > Date.now()) {
      setError('That date is in the future. Use the first day of your most recent period.');
      setResult(null);
      return;
    }
    // Roll forward so the window shown is the NEXT one, not one already past
    // (useful when the last period entered is several cycles old).
    let nextPeriod = addDays(start, cycleLength);
    while (nextPeriod.getTime() < Date.now()) nextPeriod = addDays(nextPeriod, cycleLength);
    const ovulation = addDays(nextPeriod, -14);
    captureUse('ovulation');
    const ovulationDay = cycleLength - 14 + 1;
    setResult({
      ovulation,
      nextPeriod,
      fertileStart: addDays(ovulation, -5),
      fertileEnd: addDays(ovulation, 1),
      testFrom: addDays(nextPeriod, 1),
      cycleLen: cycleLength,
      fertileFromDay: Math.max(1, ovulationDay - 5),
      fertileToDay: Math.min(cycleLength, ovulationDay + 1),
      ovulationDay,
    });
  }

  const rows: { label: string; value: string; strong?: boolean }[] = result
    ? [
        { label: 'Your best days to try for a baby', value: `${fmt(result.fertileStart)} to ${fmt(result.fertileEnd)}`, strong: true },
        { label: 'Most likely ovulation (egg release) day', value: fmt(result.ovulation) },
        { label: 'Next period expected around', value: fmt(result.nextPeriod) },
        { label: 'A pregnancy test is reliable from', value: fmt(result.testFrom) },
      ]
    : [];

  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 'clamp(20px, 4vw, 32px)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 200px' }}>
          <span className="small-text" style={{ fontWeight: 600 }}>First day of your last period</span>
          <input
            type="date"
            value={lmp}
            max={today}
            onChange={e => setLmp(e.target.value)}
            style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, font: 'inherit', background: 'var(--paper2, #faf6ee)' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 160px' }}>
          <span className="small-text" style={{ fontWeight: 600 }}>Cycle length <span style={{ fontWeight: 400, color: 'var(--ink-500)' }}>(not sure? leave as is)</span></span>
          <select
            value={cycleLength}
            onChange={e => setCycleLength(Number(e.target.value))}
            style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, font: 'inherit', background: 'var(--paper2, #faf6ee)' }}
          >
            {Array.from({ length: 20 }, (_, i) => i + 21).map(n => (
              <option key={n} value={n}>{n} days{n === 28 ? ' (most common)' : ''}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-primary" onClick={calculate} style={{ flex: '0 0 auto' }}>
          Calculate
        </button>
      </div>

      {error && (
        <p className="small-text" role="alert" style={{ color: '#b4231f', marginTop: 14, marginBottom: 0 }}>{error}</p>
      )}

      {result && (
        <div style={{ marginTop: 24, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
          <CycleStrip r={result} />
          <dl style={{ display: 'grid', gap: 12, margin: 0 }}>
            {rows.map(r => (
              <div key={r.label} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <dt className="small-text" style={{ color: 'var(--ink-500)' }}>{r.label}</dt>
                <dd style={{ margin: 0, fontWeight: r.strong ? 700 : 500 }}>{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="small-text" style={{ color: 'var(--ink-500)', marginTop: 16, marginBottom: 0 }}>
            Estimates assume your cycles are regular. If they vary by more than a few days, track ovulation signs
            alongside the calendar, and do not use these dates as contraception.
          </p>
        </div>
      )}
    </div>
  );
}
