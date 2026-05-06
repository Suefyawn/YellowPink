'use client';

import { useState } from 'react';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { Overline } from '@/components/ui/Overline';

function DuoCard({ title, subtitle, cta, imgLabel }: { title: string; subtitle: string; cta: string; imgLabel: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
    >
      <div style={{ overflow: 'hidden', borderRadius: 'var(--radius-card)' }}>
        <div className="img-placeholder" style={{
          aspectRatio: '4/3',
          transform: hovered ? 'scale(1.02)' : 'scale(1)',
          transition: 'transform 400ms ease-out',
        }}>
          <span>{imgLabel}</span>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--ink-500)' }}>{subtitle}</Overline>
        <h2 className="display-l" style={{ fontSize: '2rem', marginBottom: 12 }}>{title}</h2>
        <button className="btn-secondary">{cta}</button>
      </div>
    </div>
  );
}

export function EditorialDuo() {
  return (
    <section style={{ paddingBottom: 'var(--section-gap)' }}>
      <div className="container">
        <SectionDivider />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gutter)', marginTop: 'var(--section-gap)' }} className="duo-grid">
          <DuoCard title="Treat Melasma" subtitle="Real Solutions" cta="Explore Treatments" imgLabel="before/after melasma treatment" />
          <DuoCard title="Clear Skin" subtitle="Acne Care" cta="Shop Cleansers" imgLabel="clear skin close-up" />
        </div>
      </div>
    </section>
  );
}
