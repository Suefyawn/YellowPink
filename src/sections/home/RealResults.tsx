'use client';

import { useState } from 'react';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { Overline } from '@/components/ui/Overline';

const PEOPLE = [
  { name: 'Maria Javaid', condition: 'Melasma', quote: "I've tried hundreds of melasma treatments but nothing worked before this.", products: ['Anti-Melasma Cream'] },
  { name: 'Nida Saleem', condition: 'Acne', quote: "I've forgotten how it felt to have bumpy and uneven, acne-filled cheeks.", products: ['CeraVe Acne Cleanser'] },
  { name: 'Ayesha Khan', condition: 'Hyperpigmentation', quote: 'Visible results in just 3 weeks of consistent use.', products: ['Tinted Sunscreen SPF 46'] },
  { name: 'Fatima Ali', condition: 'Sun Damage', quote: 'My skin tone is finally even. I wish I found this sooner.', products: ['Anti-Melasma Cream', 'Tinted Sunscreen'] },
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
                <div className="img-placeholder" style={{
                  aspectRatio: '3/4', borderRadius: 'var(--radius-card)', marginBottom: 12,
                  border: selected === i ? '2px solid var(--brand-pink)' : '2px solid transparent',
                  transition: 'border-color 200ms ease-out',
                }}>
                  <span>portrait photo</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{p.name}</div>
                <Overline style={{ color: 'var(--ink-500)', fontSize: '0.625rem', display: 'block', marginTop: 2 }}>{p.condition}</Overline>
                {selected === i && (
                  <div style={{ marginTop: 10 }}>
                    <p className="body-text" style={{ color: 'var(--ink-700)', fontStyle: 'italic', marginBottom: 8 }}>
                      &ldquo;{p.quote}&rdquo;
                    </p>
                    <Overline style={{ color: 'var(--ink-500)', fontSize: '0.5625rem', display: 'block' }}>Products Used</Overline>
                    {p.products.map((pr, j) => (
                      <span key={j} style={{
                        display: 'inline-block', marginTop: 4, marginRight: 6,
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
