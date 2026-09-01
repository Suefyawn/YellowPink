// Storefront look mock-up for the Sales & occasions page. A faithful
// miniature of what an occasion publishes: the announcement bar, the themed
// page ground, and the homepage hero (copy left, image right) in the theme's
// real palette. Server component, pure CSS — no storefront code is imported,
// the swatches come from THEME_PREVIEW which mirrors globals.css.

import { THEME_PREVIEW } from '@/lib/sale-events';
import { BAR_COLORS } from '@/lib/seasonal-theme';

export interface LookPreviewProps {
  theme: string;
  barMessage?: string | null;
  barCoupon?: string | null;
  heroOverline?: string | null;
  heroHeadline?: string | null;
  heroSubline?: string | null;
  ctaText?: string | null;
  imageUrl?: string | null;
  /** compact = library card; full = the "live now" panel. */
  size?: 'compact' | 'full';
}

export function LookPreview({
  theme, barMessage, barCoupon, heroOverline, heroHeadline, heroSubline,
  ctaText, imageUrl, size = 'compact',
}: LookPreviewProps) {
  const pal = THEME_PREVIEW[theme] ?? THEME_PREVIEW.default;
  const bar = BAR_COLORS[theme] ?? pal.accent;
  const full = size === 'full';
  const headline = (heroHeadline ?? '').replace(/<br\s*\/?>/gi, '\n');

  return (
    <div style={{
      border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden',
      background: pal.paper, fontFamily: 'inherit', pointerEvents: 'none',
    }}>
      {/* Announcement bar */}
      <div style={{
        background: bar, color: 'white', padding: full ? '7px 14px' : '4px 10px',
        fontSize: full ? '0.75rem' : '0.5625rem', fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 8, minHeight: full ? 18 : 12,
        whiteSpace: 'nowrap', overflow: 'hidden',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {barMessage || ' '}
        </span>
        {barCoupon && (
          <span style={{
            flex: 'none', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.45)',
            borderRadius: 4, padding: full ? '1px 7px' : '0 5px', letterSpacing: '0.06em',
          }}>{barCoupon}</span>
        )}
      </div>
      {/* Header strip: wordmark + nav dashes, enough to read as "the site". */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: full ? '8px 14px' : '5px 10px', borderBottom: '1px solid rgba(17,24,39,0.08)',
      }}>
        <span style={{
          fontFamily: 'Georgia, serif', fontWeight: 700, color: '#111827',
          fontSize: full ? '0.8125rem' : '0.625rem',
        }}>Yellow Pink</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {[24, 18, 21].map((w, i) => (
            <span key={i} style={{ width: full ? w : w * 0.7, height: full ? 5 : 4, borderRadius: 3, background: 'rgba(17,24,39,0.18)' }} />
          ))}
        </span>
      </div>
      {/* Hero: copy left, image right. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', minHeight: full ? 150 : 84 }}>
        <div style={{ padding: full ? '16px 14px' : '9px 10px', display: 'flex', flexDirection: 'column', gap: full ? 6 : 3, justifyContent: 'center' }}>
          <span style={{
            fontSize: full ? '0.5625rem' : '0.4375rem', fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: pal.accent, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{heroOverline || 'Beauty & Wellness · Inside Out'}</span>
          <span style={{
            fontFamily: 'Georgia, serif', fontWeight: 700, color: '#111827', lineHeight: 1.12,
            fontSize: full ? '1.25rem' : '0.8125rem', whiteSpace: 'pre-line',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{headline || 'Beautiful skin.\nVital health.'}</span>
          {full && (
            <span style={{ fontSize: '0.6875rem', color: '#4b5563', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {heroSubline || 'International skincare, makeup and clinical-grade nutraceuticals.'}
            </span>
          )}
          <span style={{
            alignSelf: 'flex-start', background: pal.accent, color: 'white', borderRadius: 5,
            padding: full ? '4px 12px' : '2px 8px', fontSize: full ? '0.625rem' : '0.5rem', fontWeight: 700,
            marginTop: full ? 4 : 2, whiteSpace: 'nowrap',
          }}>{ctaText || 'Shop Beauty'}</span>
        </div>
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          {imageUrl ? (
            // Plain <img>: tiny decorative preview, next/image buys nothing here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div aria-hidden style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(at 75% 25%, ${pal.yellow}55, transparent 60%),
                radial-gradient(at 25% 75%, ${pal.accent}33, transparent 60%), ${pal.paper}`,
            }} />
          )}
          <div aria-hidden style={{ position: 'absolute', bottom: 0, left: 0, width: full ? 4 : 3, height: full ? 34 : 18, background: pal.yellow }} />
        </div>
      </div>
    </div>
  );
}
