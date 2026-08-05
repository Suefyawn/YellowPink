'use client';

// Pregnancy due-date calculator. Naegele's rule with cycle-length adjustment:
// EDD = LMP + 280 days + (cycle − 28). Also reports gestational age today,
// the trimester, and the milestone dates mothers actually plan around.
// Pure client-side; nothing personal leaves the browser.

import { useMemo, useState } from 'react';
import posthog from 'posthog-js';
import { recFor } from '@/lib/answer-recs';
import { AnswerRecCard } from './AnswerRec';

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function fmt(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

interface Result {
  edd: Date;
  weeks: number;
  days: number;
  trimester: 1 | 2 | 3;
  /** 0..1 share of the 40 weeks already behind her. */
  progress: number;
  milestones: { label: string; date: Date; passed: boolean }[];
}

// Usage analytics for the admin Quick Answers panel: one event per completed
// calculation, no personal values attached.
function captureUse(answer: string) {
  try { posthog.capture('answer_used', { answer }); } catch { /* posthog not ready */ }
}

export function DueDateCalculator() {
  const [lmp, setLmp] = useState('');
  const [cycleLength, setCycleLength] = useState(28);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  function calculate() {
    setError('');
    const start = new Date(`${lmp}T00:00:00`);
    if (!lmp || Number.isNaN(start.getTime())) {
      setError('Pick the first day of your last period.');
      setResult(null);
      return;
    }
    const gestDays = Math.floor((Date.now() - start.getTime()) / DAY_MS);
    if (gestDays < 0) {
      setError('That date is in the future. Use the first day of your most recent period.');
      setResult(null);
      return;
    }
    if (gestDays > 42 * 7) {
      setError('That date is more than 42 weeks ago. For a current pregnancy, use the most recent last period.');
      setResult(null);
      return;
    }
    const edd = addDays(start, 280 + (cycleLength - 28));
    const weeks = Math.floor(gestDays / 7);
    const days = gestDays % 7;
    const trimester: 1 | 2 | 3 = weeks < 13 ? 1 : weeks < 28 ? 2 : 3;
    const milestone = (label: string, atWeeks: number) => ({
      label,
      date: addDays(start, atWeeks * 7),
      passed: gestDays >= atWeeks * 7,
    });
    captureUse('due-date');
    setResult({
      edd,
      weeks,
      days,
      trimester,
      progress: Math.min(1, gestDays / 280),
      milestones: [
        milestone('First ultrasound usually possible', 6),
        milestone('Second trimester starts (energy usually returns)', 13),
        milestone('Big mid-pregnancy ultrasound', 19),
        milestone('Third trimester starts', 28),
        milestone('Baby is full term from here', 39),
      ],
    });
  }

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
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 600 }}>
            Due date: {fmt(result.edd)}
          </p>
          <p className="body-text" style={{ margin: '0 0 12px', color: 'var(--ink-700)' }}>
            You are {result.weeks} {result.weeks === 1 ? 'week' : 'weeks'}{result.days > 0 ? ` and ${result.days} ${result.days === 1 ? 'day' : 'days'}` : ''} pregnant today, in your {result.trimester === 1 ? 'first' : result.trimester === 2 ? 'second' : 'third'} trimester.
          </p>
          {/* The 40-week journey at a glance; trimester ticks at weeks 13/28. */}
          <div style={{ margin: '0 0 6px' }}>
            <div style={{ position: 'relative', height: 14, borderRadius: 999, background: 'var(--paper2, #faf6ee)', border: '1px solid var(--line)', overflow: 'hidden' }}>
              <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(2, result.progress * 100)}%`, background: 'linear-gradient(90deg, #e9b18f, #b05a2f)', borderRadius: 999 }} />
              <span aria-hidden="true" style={{ position: 'absolute', left: `${(13 / 40) * 100}%`, top: 0, bottom: 0, width: 1, background: 'var(--line)' }} />
              <span aria-hidden="true" style={{ position: 'absolute', left: `${(28 / 40) * 100}%`, top: 0, bottom: 0, width: 1, background: 'var(--line)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span className="small-text" style={{ fontWeight: 700 }}>Week {result.weeks} of 40</span>
              <span className="small-text" style={{ color: 'var(--ink-500)' }}>{Math.round(result.progress * 100)}% of the way there</span>
            </div>
          </div>
          <div style={{ height: 10 }} />
          <dl style={{ display: 'grid', gap: 10, margin: 0 }}>
            {result.milestones.map(m => (
              <div key={m.label} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <dt className="small-text" style={{ color: m.passed ? 'var(--ink-500)' : 'inherit' }}>
                  {m.passed ? '✓ ' : ''}{m.label}
                </dt>
                <dd className="small-text" style={{ margin: 0, fontWeight: 600, color: m.passed ? 'var(--ink-500)' : 'inherit' }}>{fmt(m.date)}</dd>
              </div>
            ))}
          </dl>
          <p className="small-text" style={{ color: 'var(--ink-500)', marginTop: 16, marginBottom: 0 }}>
            Only about one baby in twenty arrives on the exact due date; most arrive within two weeks either
            side. Your doctor may adjust this date after the first ultrasound, which is the more precise measure.
          </p>
          {(() => {
            const rec = recFor('due-date', result.trimester === 1 ? 't1' : 't23');
            return rec ? <AnswerRecCard rec={rec} tint="#fdeee7" accent="#b05a2f" /> : null;
          })()}
        </div>
      )}
    </div>
  );
}
