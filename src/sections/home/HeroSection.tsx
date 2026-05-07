import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';

interface HeroSettings {
  overline: string;
  headline: string;
  subline: string;
  cta1Text: string;
  cta1Url: string;
  cta2Text: string;
  cta2Url: string;
  imageUrl: string;
  brands: string[];
}

const DEFAULTS: HeroSettings = {
  overline: 'Beauty & Wellness · Inside Out',
  headline: 'Beautiful skin.<br/><em>Vital health.</em>',
  subline: 'International skincare, makeup, and clinical-grade nutraceuticals — because real beauty is health from the inside out. Now in Pakistan with COD.',
  cta1Text: 'Shop Beauty',
  cta1Url: '/shop',
  cta2Text: 'Explore Wellness',
  cta2Url: '/shop?category=Wellness',
  imageUrl: '',
  brands: ['NARS', 'Kiko Milano', 'PIXI', 'CeraVe'],
};

export function HeroSection({ settings }: { settings?: Partial<HeroSettings> }) {
  const s: HeroSettings = { ...DEFAULTS, ...settings };

  // Convert newlines to <br/> for headline
  const headlineHtml = s.headline
    .replace(/\n/g, '<br/>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

  return (
    <section style={{ padding: 0, borderBottom: '1px solid var(--line)' }}>
      <div className="container hero-grid" style={{
        display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', minHeight: 520, alignItems: 'center',
      }}>
        <div style={{ paddingRight: 48, paddingTop: 48, paddingBottom: 48 }}>
          <Overline style={{ display: 'block', marginBottom: 16, color: 'var(--ink-500)' }}>{s.overline}</Overline>
          <h1
            className="display-xl"
            style={{ marginBottom: 20 }}
            dangerouslySetInnerHTML={{ __html: headlineHtml }}
          />
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 400, marginBottom: 28 }}>
            {s.subline}
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href={s.cta1Url} className="btn-primary">{s.cta1Text}</Link>
            {s.cta2Text && <Link href={s.cta2Url} className="btn-secondary">{s.cta2Text}</Link>}
          </div>
          {s.brands.length > 0 && (
            <div style={{ marginTop: 24, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              {s.brands.map(b => (
                <span key={b} style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-500)' }}>{b}</span>
              ))}
            </div>
          )}
        </div>

        <div style={{ position: 'relative', alignSelf: 'stretch' }}>
          {s.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={s.imageUrl}
              alt="Yellow Pink — Beauty & Wellness"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, #fdf2f8 0%, #fef9ec 50%, #fdf2f8 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ textAlign: 'center', color: 'var(--ink-400)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 8 }}>✦</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Add hero image<br />in Admin → Settings
                </div>
              </div>
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: 6, height: 80, background: 'var(--brand-yellow)' }} />
        </div>
      </div>
    </section>
  );
}
