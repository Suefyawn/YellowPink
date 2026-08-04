'use client';

// BMI calculator with South Asian cutoffs. WHO's standard bands understate
// metabolic risk for South Asian bodies; Pakistani guidelines flag overweight
// from BMI 23 and obesity from 27.5, so both readings are shown. Pure
// client-side maths, nothing leaves the browser.

import { useState } from 'react';
import posthog from 'posthog-js';

interface Result {
  bmi: number;
  asianCategory: string;
  whoCategory: string;
  healthyRange: string;
}

function categorize(bmi: number, cuts: [number, number, number], labels: [string, string, string, string]): string {
  if (bmi < cuts[0]) return labels[0];
  if (bmi < cuts[1]) return labels[1];
  if (bmi < cuts[2]) return labels[2];
  return labels[3];
}

// Usage analytics for the admin Quick Answers panel: one event per completed
// calculation, no personal values attached.
function captureUse(answer: string) {
  try { posthog.capture('answer_used', { answer }); } catch { /* posthog not ready */ }
}

export function BmiCalculator() {
  const [unit, setUnit] = useState<'cm' | 'ftin'>('cm');
  const [weight, setWeight] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  function calculate() {
    setError('');
    const w = Number(weight);
    const cm = unit === 'cm'
      ? Number(heightCm)
      : Number(heightFt) * 30.48 + Number(heightIn || '0') * 2.54;
    if (!w || w < 20 || w > 300) { setError('Enter a weight between 20 and 300 kg.'); setResult(null); return; }
    if (!cm || cm < 100 || cm > 250) { setError(unit === 'cm' ? 'Enter a height between 100 and 250 cm.' : 'Enter a height between 3 ft 4 in and 8 ft.'); setResult(null); return; }
    const m = cm / 100;
    const bmi = w / (m * m);
    captureUse('bmi');
    setResult({
      bmi,
      asianCategory: categorize(bmi, [18.5, 23, 27.5], ['Underweight', 'Healthy weight', 'Overweight', 'Obese']),
      whoCategory: categorize(bmi, [18.5, 25, 30], ['Underweight', 'Healthy weight', 'Overweight', 'Obese']),
      healthyRange: `${(18.5 * m * m).toFixed(1)} to ${(22.9 * m * m).toFixed(1)} kg`,
    });
  }

  const inputStyle: React.CSSProperties = { padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, font: 'inherit', background: 'var(--paper2, #faf6ee)', width: '100%' };

  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 'clamp(20px, 4vw, 32px)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 140px' }}>
          <span className="small-text" style={{ fontWeight: 600 }}>Weight (kg)</span>
          <input type="number" inputMode="decimal" min={20} max={300} value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 65" style={inputStyle} />
        </label>
        {unit === 'cm' ? (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 140px' }}>
            <span className="small-text" style={{ fontWeight: 600 }}>Height (cm)</span>
            <input type="number" inputMode="decimal" min={100} max={250} value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="e.g. 162" style={inputStyle} />
          </label>
        ) : (
          <div style={{ display: 'flex', gap: 8, flex: '1 1 180px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <span className="small-text" style={{ fontWeight: 600 }}>Height (ft)</span>
              <input type="number" inputMode="numeric" min={3} max={8} value={heightFt} onChange={e => setHeightFt(e.target.value)} placeholder="5" style={inputStyle} />
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
            BMI {result.bmi.toFixed(1)}: {result.asianCategory}
          </p>
          <dl style={{ display: 'grid', gap: 10, margin: '14px 0 0' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <dt className="small-text" style={{ color: 'var(--ink-500)' }}>South Asian scale (applies in Pakistan)</dt>
              <dd className="small-text" style={{ margin: 0, fontWeight: 600 }}>{result.asianCategory}</dd>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <dt className="small-text" style={{ color: 'var(--ink-500)' }}>WHO standard scale</dt>
              <dd className="small-text" style={{ margin: 0, fontWeight: 600 }}>{result.whoCategory}</dd>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <dt className="small-text" style={{ color: 'var(--ink-500)' }}>Healthy weight for your height (South Asian)</dt>
              <dd className="small-text" style={{ margin: 0, fontWeight: 600 }}>{result.healthyRange}</dd>
            </div>
          </dl>
          <p className="small-text" style={{ color: 'var(--ink-500)', marginTop: 16, marginBottom: 0 }}>
            BMI is a screening number, not a diagnosis. It cannot tell muscle from fat, and it says nothing
            about where fat sits, which matters more. Read it as a starting point and talk to a doctor about
            what it means for you.
          </p>
        </div>
      )}
    </div>
  );
}
