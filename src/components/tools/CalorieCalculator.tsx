'use client';

// Daily calorie calculator: Mifflin-St Jeor BMR × activity factor, with
// lose / maintain / gain targets and a daily protein figure. Client-side
// only, nothing personal leaves the browser.

import { useState } from 'react';

const ACTIVITY = [
  { label: 'Mostly sitting (desk job, little exercise)', factor: 1.2 },
  { label: 'Lightly active (walks, 1 to 2 workouts a week)', factor: 1.375 },
  { label: 'Moderately active (3 to 5 workouts a week)', factor: 1.55 },
  { label: 'Very active (6 to 7 workouts a week)', factor: 1.725 },
  { label: 'Athlete / physical job', factor: 1.9 },
] as const;

interface Result {
  bmr: number;
  maintain: number;
  lose: number;
  gain: number;
  proteinMin: number;
  proteinMax: number;
}

export function CalorieCalculator() {
  const [sex, setSex] = useState<'female' | 'male'>('female');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [activity, setActivity] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  function calculate() {
    setError('');
    const a = Number(age), w = Number(weight), h = Number(heightCm);
    if (!a || a < 15 || a > 90) { setError('Enter an age between 15 and 90.'); setResult(null); return; }
    if (!w || w < 30 || w > 250) { setError('Enter a weight between 30 and 250 kg.'); setResult(null); return; }
    if (!h || h < 120 || h > 230) { setError('Enter a height between 120 and 230 cm.'); setResult(null); return; }
    const bmr = Math.round(10 * w + 6.25 * h - 5 * a + (sex === 'male' ? 5 : -161));
    const maintain = Math.round(bmr * ACTIVITY[activity].factor);
    setResult({
      bmr,
      maintain,
      lose: Math.max(1200, maintain - 500),
      gain: maintain + 300,
      proteinMin: Math.round(w * 1.2),
      proteinMax: Math.round(w * 1.6),
    });
  }

  const inputStyle: React.CSSProperties = { padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, font: 'inherit', background: 'var(--paper2, #faf6ee)', width: '100%' };
  const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 120px' };

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
        <label style={labelStyle}>
          <span className="small-text" style={{ fontWeight: 600 }}>Height (cm)</span>
          <input type="number" inputMode="decimal" min={120} max={230} value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="e.g. 162" style={inputStyle} />
        </label>
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
          <p style={{ margin: '0 0 14px', fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 600 }}>
            Maintenance: about {result.maintain.toLocaleString()} kcal a day
          </p>
          <dl style={{ display: 'grid', gap: 10, margin: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <dt className="small-text" style={{ color: 'var(--ink-500)' }}>To lose weight steadily (about 0.5 kg a week)</dt>
              <dd className="small-text" style={{ margin: 0, fontWeight: 600 }}>{result.lose.toLocaleString()} kcal</dd>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <dt className="small-text" style={{ color: 'var(--ink-500)' }}>To gain weight or build muscle</dt>
              <dd className="small-text" style={{ margin: 0, fontWeight: 600 }}>{result.gain.toLocaleString()} kcal</dd>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <dt className="small-text" style={{ color: 'var(--ink-500)' }}>Resting metabolism (BMR)</dt>
              <dd className="small-text" style={{ margin: 0, fontWeight: 600 }}>{result.bmr.toLocaleString()} kcal</dd>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <dt className="small-text" style={{ color: 'var(--ink-500)' }}>Daily protein target</dt>
              <dd className="small-text" style={{ margin: 0, fontWeight: 600 }}>{result.proteinMin} to {result.proteinMax} g</dd>
            </div>
          </dl>
          <p className="small-text" style={{ color: 'var(--ink-500)', marginTop: 16, marginBottom: 0 }}>
            These are estimates for healthy adults; real needs vary with genetics and daily movement. Adjust
            after two weeks of real results, and do not eat below 1,200 kcal a day without medical supervision.
          </p>
        </div>
      )}
    </div>
  );
}
