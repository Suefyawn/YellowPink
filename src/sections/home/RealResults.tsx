'use client';

import { useState } from 'react';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { Overline } from '@/components/ui/Overline';

const PEOPLE = [
  { name: 'Maria J.', condition: 'Melasma', quote: "I've tried countless melasma treatments but nothing worked before this. 3 weeks and visible difference!", products: ['Anti-Melasma Cream'], color: '#E8487F' },
  { name: 'Nida S.', condition: 'Acne', quote: "I've forgotten how it felt to have bumpy, acne-filled cheeks. My skin is clearer than ever.", products: ['CeraVe Acne Cleanser'], color: '#6366f1' },
  { name: 'Ayesha K.', condition: 'Hyperpigmentation', quote: 'Visible results in just 3 weeks of consistent use. My colleagues keep asking what I changed.', products: ['Tinted Sunscreen SPF 46'], color: '#F7C948' },
  { name: 'Fatima A.', condition: 'Sun Damage', quote: 'My skin tone is finally even. I wish I found this sooner — genuinely life changing.', products: ['Anti-Melasma Cream', 'Tinted Sunscreen'], color: '#10b981' },
];

export function RealResults() {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <section style={{ paddingBottom: 'var(--section-gap)' }}>
      <div className="container">
        <SectionDivider />
        <div style={{ marginTop: 'var(--section-gap)' }}>
          <Overline style={{ display: 'block', marginBottom: 8 }}>Real Results</Overline>
          <h2 className="display-l" style={{ fontSize: '2.25rem', marginBottom: 32 }}>
            Real people. Life-changing results.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }} className="results-grid">
            {PEOPLE.map((p, i) => (
              <div key={i} style={{ cursor: 'pointer' }} onClick={() => setSelected(selected === i ? null : i)}>
                {/* Avatar with initial */}
                <div style={{
                  aspectRatio: '3/4', borderRadius: 'var(--radius-card)', marginBottom: 12,
                  border: `2px solid ${selected === i ? p.color : 'transparent'}`,
                  transition: 'border-color 200ms ease-out',
                  background: `linear-gradient(135deg, ${p.color}22 0%, ${p.color}44 100%)`,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 16,
                }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: p.color, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.75rem', fontFamily: 'var(--font-display)',
                    fontWeight: 500, color: '#fff',
                  }}>
                    {p.name.charAt(0)}
                  </div>
                  <div style={{ textAlign: 'center', padding: '0 12px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>{p.name}</div>
                    <Overline style={{ color: p.color, fontSize: '0.5625rem', display: 'block', marginTop: 4 }}>{p.condition}</Overline>
                  </div>
                  {/* Star rating */}
                  <div>
                    {[1,2,3,4,5].map(s => <span key={s} style={{ color: '#F7C948', fontSize: '1rem' }}>★</span>)}
                  </div>
                </div>

                {selected === i && (
                  <div style={{ marginTop: 4 }}>
                    <p className="body-text" style={{ color: 'var(--ink-700)', fontStyle: 'italic', marginBottom: 8 }}>
                      &ldquo;{p.quote}&rdquo;
                    </p>
                    <Overline style={{ color: 'var(--ink-500)', fontSize: '0.5625rem', display: 'block', marginBottom: 4 }}>Products Used</Overline>
                    {p.products.map((pr, j) => (
                      <span key={j} style={{
                        display: 'inline-block', marginRight: 6, marginBottom: 4,
                        padding: '2px 8px', background: 'var(--paper2)',
                        borderRadius: 'var(--radius-pill)', fontSize: '0.75rem', fontWeight: 500,
                      }}>{pr}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
