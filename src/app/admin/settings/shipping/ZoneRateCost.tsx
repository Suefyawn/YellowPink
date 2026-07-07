'use client';

import { useState } from 'react';

// Rate + cost inputs with a LIVE margin readout — the "stop small losses"
// guard. Submits native `rate` / `cost` fields with the surrounding zone form;
// warns in red the moment the charged rate drops below the courier cost.
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', boxSizing: 'border-box' };

export function ZoneRateCost({ defaultRate, defaultCost }: { defaultRate?: number | null; defaultCost?: number | null }) {
  const [rate, setRate] = useState(defaultRate != null ? String(defaultRate) : '');
  const [cost, setCost] = useState(defaultCost != null ? String(defaultCost) : '');

  const r = Number(rate);
  const c = Number(cost);
  const hasBoth = rate !== '' && cost !== '' && Number.isFinite(r) && Number.isFinite(c);
  const margin = hasBoth ? r - c : null;
  const losing = margin != null && margin < 0;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={lbl}>Rate charged (PKR)</label>
          <input name="rate" type="number" min={0} value={rate} onChange={e => setRate(e.target.value)} required style={inp} />
        </div>
        <div>
          <label style={lbl}>Your cost / courier bill (PKR)</label>
          <input name="cost" type="number" min={0} value={cost} onChange={e => setCost(e.target.value)} placeholder="e.g. 330" style={inp} />
        </div>
      </div>
      {margin != null && (
        <div
          role="status"
          style={{
            fontSize: '0.8125rem', fontWeight: 600, padding: '6px 10px', borderRadius: 8,
            background: losing ? '#fef2f2' : '#f0fdf4',
            color: losing ? '#b91c1c' : '#15803d',
            border: `1px solid ${losing ? '#fecaca' : '#bbf7d0'}`,
          }}
        >
          {losing
            ? `⚠ Losing PKR ${Math.abs(margin)} per paid order in this zone — raise the rate or lower cost.`
            : `Margin: +PKR ${margin} per paid order (before any free-shipping orders).`}
        </div>
      )}
    </div>
  );
}
