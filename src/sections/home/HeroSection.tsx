'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Overline } from '@/components/ui/Overline';

interface HeroBrand { name: string; logoUrl: string | null }

interface HeroSettings {
  overline: string;
  headline: string;
  subline: string;
  cta1Text: string;
  cta1Url: string;
  cta2Text: string;
  cta2Url: string;
  imageUrl: string;
  brands: HeroBrand[];
}

const DEFAULTS: HeroSettings = {
  overline: 'Beauty & Wellness · Inside Out',
  headline: 'Beautiful skin.<br/><em>Vital health.</em>',
  subline: 'International skincare, makeup, and clinical-grade nutraceuticals, because real beauty is health from the inside out. Now in Pakistan with COD.',
  cta1Text: 'Shop Beauty',
  cta1Url: '/shop',
  cta2Text: 'Explore Wellness',
  // Taxon form: `?category=Wellness` matches no leaf category (the real
  // values are "Women's Health", "Immunity", …) and rendered an empty grid.
  cta2Url: '/shop?taxon=wellness',
  imageUrl: '',
  brands: [
    { name: 'NARS', logoUrl: null }, { name: 'Kiko Milano', logoUrl: null },
    { name: 'PIXI', logoUrl: null }, { name: 'CeraVe', logoUrl: null },
  ],
};

// Soft, on-brand gradient that stands in for the hero photo until the
// merchant uploads one in admin/settings. Intentionally text-free, it
// looks like a deliberate design, not "broken admin chatter on the
// customer page".
const GradientFallback = () => (
  <div
    aria-hidden="true"
    style={{
      position: 'absolute', inset: 0,
      background: `
        radial-gradient(at 78% 22%, rgba(247, 201, 72, 0.45), transparent 55%),
        radial-gradient(at 22% 78%, rgba(232, 72, 127, 0.35), transparent 55%),
        linear-gradient(135deg, #fdf2f8 0%, #fef9ec 50%, #fdf2f8 100%)`,
    }}
  />
);

export function HeroSection({ settings }: { settings?: Partial<HeroSettings> }) {
  // Merge per-field, not by object spread: the homepage passes '' for any
  // site_settings key that's missing (fresh DB, half-seeded settings), and
  // a plain spread let those empty strings clobber the defaults, shipping a
  // blank <h1> and a CTA with href="". An empty headline / CTA target must
  // be impossible, so every load-bearing field falls back when blank.
  // cta2Text keeps ?? (not ||): an admin clearing the secondary CTA text is
  // a deliberate "hide the second button", honoured by the render below.
  const s: HeroSettings = {
    overline: settings?.overline || DEFAULTS.overline,
    headline: settings?.headline || DEFAULTS.headline,
    subline:  settings?.subline  || DEFAULTS.subline,
    cta1Text: settings?.cta1Text || DEFAULTS.cta1Text,
    cta1Url:  settings?.cta1Url  || DEFAULTS.cta1Url,
    cta2Text: settings?.cta2Text ?? DEFAULTS.cta2Text,
    cta2Url:  settings?.cta2Url  || DEFAULTS.cta2Url,
    imageUrl: settings?.imageUrl || DEFAULTS.imageUrl,
    brands:   settings?.brands   ?? DEFAULTS.brands,
  };
  const [imgFailed, setImgFailed] = useState(false);

  // Convert newlines to <br/> for headline
  const headlineHtml = s.headline
    .replace(/\n/g, '<br/>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

  return (
    <section style={{ padding: 0, borderBottom: '1px solid var(--line)' }}>
      <style>{`
        /* Trust-logo marquee: a fixed-size slot per brand (so a tall square
           logo and a wide wordmark read as the same "weight"), duplicated
           once and scrolled by exactly half the track's width so the loop
           is seamless, no snap-back visible. Wrapping to a second line
           (the old flex-wrap row) was what broke once the picker grew past
           4 brands; a marquee has no line to wrap onto. */
        .hero-brand-marquee {
          position: relative; overflow: hidden; width: 100%;
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 28px, #000 calc(100% - 28px), transparent);
          mask-image: linear-gradient(90deg, transparent, #000 28px, #000 calc(100% - 28px), transparent);
        }
        .hero-brand-track {
          display: flex; align-items: center; gap: 32px; width: max-content;
          animation: hero-brand-scroll 24s linear infinite;
        }
        .hero-brand-marquee:hover .hero-brand-track { animation-play-state: paused; }
        .hero-brand-slot {
          display: flex; align-items: center; justify-content: center;
          width: 92px; height: 30px; flex-shrink: 0;
        }
        .hero-brand-logo {
          max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;
          filter: grayscale(1); opacity: 0.7; transition: filter 160ms ease-out, opacity 160ms ease-out;
        }
        .hero-brand-logo:hover { filter: none; opacity: 1; }
        .hero-brand-text {
          font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.12em;
          text-transform: uppercase; color: var(--ink-500); white-space: nowrap;
        }
        @keyframes hero-brand-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-brand-track { animation: none; }
        }
        @media (max-width: 480px) {
          .hero-brand-block { max-width: none !important; }
          .hero-brand-track { gap: 22px; }
          .hero-brand-slot { width: 76px; height: 24px; }
        }
      `}</style>
      <div className="container hero-grid" style={{
        // minmax(0, …): a bare fr track's automatic minimum is its content's
        // min-content size, and the brand marquee inside the left column is
        // width:max-content (~1.6k px with 8 brands duplicated for the loop).
        // Without the 0 floor the column blows out to the marquee's width and
        // the whole homepage scrolls sideways on phones.
        display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)', minHeight: 520, alignItems: 'center',
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
            <div className="hero-brand-block" style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--line)', maxWidth: 420 }}>
              <span style={{ display: 'block', marginBottom: 12, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-500)' }}>
                Authentic stock from
              </span>
              <div className="hero-brand-marquee">
                <div className="hero-brand-track">
                  {/* Rendered twice back-to-back so translateX(-50%) loops
                      seamlessly; the second copy is aria-hidden so screen
                      readers see the brand list once, not doubled. */}
                  {[...s.brands, ...s.brands].map((b, i) => (
                    <span key={`${b.name}-${i}`} className="hero-brand-slot" aria-hidden={i >= s.brands.length || undefined}>
                      {b.logoUrl ? (
                        // Plain <img>, not next/image: these are small trust logos of
                        // wildly varying aspect ratio from many hosts (Shopify CDNs,
                        // local /brands/*), a fixed-size responsive optimisation buys
                        // nothing here. Grayscale by default, full colour on hover, a
                        // common "as-stocked-by" treatment that reads as curated
                        // rather than a wall of clashing brand colours.
                        // Lazy: these are decorative below-the-headline trust
                        // marks — eager plain <img> in the initial HTML made
                        // the framework emit a head <link rel="preload"> for
                        // every logo, competing with the real LCP for
                        // bandwidth. Remote logo URLs route through the
                        // same-origin /img proxy like all other imagery.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={/^https?:\/\//.test(b.logoUrl) ? `/img?src=${encodeURIComponent(b.logoUrl)}&w=184&q=75` : b.logoUrl}
                          alt={b.name}
                          title={b.name}
                          loading="lazy"
                          decoding="async"
                          className="hero-brand-logo"
                        />
                      ) : (
                        <span className="hero-brand-text">{b.name}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative', alignSelf: 'stretch' }}>
          {s.imageUrl && !imgFailed ? (
            <Image
              src={s.imageUrl}
              alt="Yellow Pink, Beauty & Wellness"
              fill
              // Hero shot is the LCP, `preload` (this fork's replacement for
              // the deprecated `priority`) emits a <link rel="preload">;
              // eager + fetchpriority make the browser fetch it first.
              // `sizes` matches the grid: 90vw on phones (single column),
              // 45vw on desktop (right column of a 1.1fr/0.9fr split).
              preload
              loading="eager"
              fetchPriority="high"
              sizes="(max-width: 900px) 100vw, 45vw"
              onError={() => setImgFailed(true)}
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <GradientFallback />
          )}
          <div aria-hidden="true" style={{ position: 'absolute', bottom: 0, left: 0, width: 6, height: 80, background: 'var(--brand-yellow)' }} />
        </div>
      </div>
    </section>
  );
}
