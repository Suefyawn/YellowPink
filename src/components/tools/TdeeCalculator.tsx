'use client';

// TDEE calculator: Mifflin-St Jeor BMR × the standard activity multipliers
// (1.2 / 1.375 / 1.55 / 1.725 / 1.9), with a table of calorie targets for
// mild loss, loss, maintenance, mild gain and gain. Client-side only,
// nothing personal leaves the browser.

import { useState } from 'react';
import posthog from 'posthog-js';

const ACTIVITY = [
  { label: 'Mostly sitting (desk job, little exercise)', factor: 1.2 },
  { label: 'Lightly active (walks, 1 to 2 workouts a week)', factor: 1.375 },
  { label: 'Moderately active (3 to 5 workouts a week)', factor: 1.55 },
  { label: 'Very active (6 to 7 workouts a week)', factor: 1.725 },
  { label: 'Athlete / physical job', factor: 1.9 },
] as const;

interface Result {
  bmr: number;
  tdee: number;
}

// Usage analytics for the admin Quick Answers panel: one event per completed
// calculation, no personal values attached.
function captureUse(answer: string) {
  try { posthog.capture('answer_used', { answer }); } catch { /* posthog not ready */ }
}

export function TdeeCalculator() {
  const [sex, setSex] = useState<'female' | 'male'>('female');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<'cm' | 'ftin'>('cm');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [activity, setActivity] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  function calculate() {
    setError('');
    const a = Number(age), w = Number(weight);
    const h = unit === 'cm'
      ? Number(heightCm)
      : Number(heightFt) * 30.48 + Number(heightIn || '0') * 2.54;
    if (!a || a < 15 || a > 90) { setError('Enter an age between 15 and 90.'); setResult(null); return; }
    if (!w || w < 30 || w > 250) { setError('Enter a weight between 30 and 250 kg.'); setResult(null); return; }
    if (!h || h < 120 || h > 230) { setError(unit === 'cm' ? 'Enter a height between 120 and 230 cm.' : 'Enter a height between 4 ft and 7 ft 6 in.'); setResult(null); return; }
    const bmr = Math.round(10 * w + 6.25 * h - 5 * a + (sex === 'male' ? 5 : -161));
    const tdee = Math.round(bmr * ACTIVITY[activity].factor);
    captureUse('tdee');
    setResult({ bmr, tdee });
  }

  const inputStyle: React.CSSProperties = { padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, font: 'inherit', background: 'var(--paper2, #faf6ee)', width: '100%' };
  const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 120px' };

  // Calorie targets around the TDEE. Loss rows keep the same 1,200 kcal
  // safety floor the calorie calculator uses.
  const targets = result ? [
    { label: 'Mild weight loss', pace: 'about 0.25 kg a week', value: Math.max(1200, result.tdee - 250) },
    { label: 'Weight loss', pace: 'about 0.5 kg a week', value: Math.max(1200, result.tdee - 500) },
    { label: 'Maintain weight', pace: 'your TDEE', value: result.tdee },
    { label: 'Mild weight gain', pace: 'about 0.25 kg a week', value: result.tdee + 250 },
    { label: 'Weight gain', pace: 'about 0.5 kg a week', value: result.tdee + 500 },
  ] : [];

  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 'clamp(20px, 4vw, 32px)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        <label style={labelStyle}>
          <span className="small-text" style={{ fontWeight: 600 }}>Sex</span>
          <select value={sex} onChange={e => setSex(e.target.value as 'female' | 'male')} style={inputStyle}>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
        <label style={labelStyle}>
          <span className="small-text" style={{ fontWeight: 600 }}>Age</span>
          <input type="number" inputMode="numeric" min={15} max={90} value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 28" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          <span className="small-text" style={{ fontWeight: 600 }}>Weight (kg)</span>
          <input type="number" inputMode="decimal" min={30} max={250} value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 65" style={inputStyle} />
        </label>
        {unit === 'cm' ? (
          <label style={labelStyle}>
            <span className="small-text" style={{ fontWeight: 600 }}>Height (cm)</span>
            <input type="number" inputMode="decimal" min={120} max={230} value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="e.g. 162" style={inputStyle} />
          </label>
        ) : (
          <div style={{ display: 'flex', gap: 8, flex: '1 1 160px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <span className="small-text" style={{ fontWeight: 600 }}>Height (ft)</span>
              <input type="number" inputMode="numeric" min={4} max={7} value={heightFt} onChange={e => setHeightFt(e.target.value)} placeholder="5" style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <span className="small-text" style={{ fontWeight: 600 }}>in</span>
              <input type="number" inputMode="numeric" min={0} max={11} value={heightIn} onChange={e => setHeightIn(e.target.value)} placeholder="4" style={inputStyle} />
            </label>
          </div>
        )}
        <button
          type="button"
          onClick={() => setUnit(unit === 'cm' ? 'ftin' : 'cm')}
          className="small-text"
          style={{ background: 'none', border: 'none', color: 'var(--ink-500)', cursor: 'pointer', textDecoration: 'underline', padding: '10px 0', flex: '0 0 auto' }}
        >
          {unit === 'cm' ? 'Use ft/in' : 'Use cm'}
        </button>
        <label style={{ ...labelStyle, flex: '2 1 240px' }}>
          <span className="small-text" style={{ fontWeight: 600 }}>Activity level</span>
          <select value={activity} onChange={e => setActivity(Number(e.target.value))} style={inputStyle}>
            {ACTIVITY.map((opt, i) => (
              <option key={opt.label} value={i}>{opt.label}</option>
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
          {/* TDEE leads, big and tinted; BMR sits beside it as the smaller
              reference number. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, margin: '0 0 18px' }}>
            <div style={{ borderRadius: 10, padding: '16px 14px 14px', textAlign: 'center', background: '#e8f4f2', border: '1px solid #b8dcd6' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#0f766e' }}>Your TDEE</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 600, margin: '4px 0 2px', fontVariantNumeric: 'tabular-nums' }}>{result.tdee.toLocaleString()}</div>
              <div className="small-text" style={{ color: 'var(--ink-500)' }}>kcal burned per day</div>
            </div>
            <div style={{ borderRadius: 10, padding: '16px 14px 14px', textAlign: 'center', background: 'var(--paper2, #faf6ee)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-500)' }}>Your BMR</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 600, margin: '4px 0 2px', fontVariantNumeric: 'tabular-nums' }}>{result.bmr.toLocaleString()}</div>
              <div className="small-text" style={{ color: 'var(--ink-500)' }}>kcal at complete rest</div>
            </div>
          </div>

          <p style={{ margin: '0 0 10px', fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 600 }}>
            Daily calorie targets from your TDEE
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 380 }}>
              <thead>
                <tr>
                  <th className="small-text" style={{ textAlign: 'left', fontWeight: 700, padding: '6px 10px 6px 0', borderBottom: '1px solid var(--line)' }}>Goal</th>
                  <th className="small-text" style={{ textAlign: 'left', fontWeight: 700, padding: '6px 10px', borderBottom: '1px solid var(--line)' }}>Pace</th>
                  <th className="small-text" style={{ textAlign: 'right', fontWeight: 700, padding: '6px 0 6px 10px', borderBottom: '1px solid var(--line)' }}>kcal / day</th>
                </tr>
              </thead>
              <tbody>
                {targets.map(t => {
                  const main = t.value === result.tdee && t.label === 'Maintain weight';
                  return (
                    <tr key={t.label} style={main ? { background: '#e8f4f2' } : undefined}>
                      <td className="small-text" style={{ padding: '8px 10px 8px 0', fontWeight: main ? 700 : 600, borderBottom: '1px solid var(--line)' }}>{t.label}</td>
                      <td className="small-text" style={{ padding: '8px 10px', color: 'var(--ink-500)', borderBottom: '1px solid var(--line)' }}>{t.pace}</td>
                      <td className="small-text" style={{ padding: '8px 0 8px 10px', textAlign: 'right', fontWeight: main ? 700 : 600, fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--line)' }}>{t.value.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="small-text" style={{ color: 'var(--ink-500)', marginTop: 16, marginBottom: 0 }}>
            These are estimates for healthy adults; real needs vary with genetics and daily movement. Adjust
            after two weeks of real results, and do not eat below 1,200 kcal a day without medical supervision.
          </p>
        </div>
      )}
    </div>
  );
}
