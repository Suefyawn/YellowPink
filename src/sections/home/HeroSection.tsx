import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';

export function HeroSection() {
  return (
    <section style={{ padding: 0, borderBottom: '1px solid var(--line)' }}>
      <div className="container hero-grid" style={{
        display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', minHeight: 520, alignItems: 'center',
      }}>
        <div style={{ paddingRight: 48, paddingTop: 48, paddingBottom: 48 }}>
          <Overline style={{ display: 'block', marginBottom: 16, color: 'var(--ink-500)' }}>Beauty & Wellness · Inside Out</Overline>
          <h1 className="display-xl" style={{ marginBottom: 20 }}>
            Beautiful skin.<br /><em style={{ fontStyle: 'italic' }}>Vital health.</em>
          </h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 400, marginBottom: 28 }}>
            International skincare, makeup, and clinical-grade nutraceuticals — because real beauty is health from the inside out. Now in Pakistan with COD.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href="/shop" className="btn-primary">Shop Beauty</Link>
            <Link href="/shop?category=Wellness" className="btn-secondary">Explore Wellness</Link>
          </div>
          <div style={{ marginTop: 24, display: 'flex', gap: 20, alignItems: 'center' }}>
            {['Tarte', 'NARS', 'Rhode', 'CeraVe'].map(b => (
              <span key={b} style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-500)' }}>{b}</span>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', alignSelf: 'stretch' }}>
          <div className="img-placeholder" style={{ position: 'absolute', inset: 0, borderRadius: 0 }}>
            <span>hero: confident face +<br />supplement bottle<br />beauty meets vitality</span>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: 6, height: 80, background: 'var(--brand-yellow)' }} />
        </div>
      </div>
    </section>
  );
}
