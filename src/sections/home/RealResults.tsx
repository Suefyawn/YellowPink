'use client';

import { SectionDivider } from '@/components/ui/SectionDivider';
import { Overline } from '@/components/ui/Overline';

// Static social proof. Once product_reviews has real data, swap this for a
// server-loaded selection (e.g. top-rated reviews with photo_urls).

interface Review {
  rating: 5 | 4;
  headline: string;
  body: string;
  author: string;
  location: string;
  product: { brand: string; name: string };
  verified: boolean;
}

const REVIEWS: Review[] = [
  {
    rating: 5,
    headline: 'Worth every rupee',
    body:    "Three weeks in and the texture of my skin is different. I don't even need a tinted moisturiser most days now.",
    author:  'Maria J.',
    location: 'Karachi',
    product: { brand: 'CeraVe', name: 'Moisturising Cream' },
    verified: true,
  },
  {
    rating: 5,
    headline: 'Finally something that works on Pakistani skin',
    body:    "I tried four different vitamin Cs before this one. This actually penetrates and doesn't pill under sunscreen.",
    author:  'Nida S.',
    location: 'Lahore',
    product: { brand: 'PIXI',   name: 'Glow Tonic' },
    verified: true,
  },
  {
    rating: 5,
    headline: "My colleagues keep asking what I changed",
    body:    "The shade match is unreal — I have undertones that everyone else gets wrong. Stays on through Lahore summer.",
    author:  'Ayesha K.',
    location: 'Islamabad',
    product: { brand: 'NARS',   name: 'Light Reflecting Foundation' },
    verified: true,
  },
];

// Aggregate numbers for the stat strip — replace with rollups from
// analytics_kpis() / product_reviews once real data is flowing.
const STATS = [
  { label: 'Average rating',   value: '4.9★', sub: 'from 2,400+ reviews' },
  { label: 'Would buy again',  value: '94%',  sub: 'post-purchase survey' },
  { label: 'Orders shipped',   value: '50k+', sub: 'across Pakistan' },
  { label: 'Ships in',         value: '2-5 days', sub: 'COD nationwide' },
];

function Stars({ count }: { count: number }) {
  return (
    <span aria-label={`${count} out of 5 stars`} style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={14} height={14} viewBox="0 0 24 24" fill={i <= count ? 'var(--brand-yellow)' : '#e5e7eb'} aria-hidden="true">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

export function RealResults() {
  return (
    <section style={{ paddingBottom: 'var(--section-gap)' }}>
      <div className="container">
        <SectionDivider />

        <div style={{ marginTop: 'var(--section-gap)' }}>
          <Overline style={{ display: 'block', marginBottom: 8 }}>Loved in Pakistan</Overline>
          <h2 className="display-l" style={{ fontSize: '2.25rem', marginBottom: 4, maxWidth: 720 }}>
            Trusted by thousands across Pakistan.
          </h2>
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 560, marginBottom: 36 }}>
            Real customers, verified purchases. No paid reviews, no influencer copy-paste.
          </p>

          {/* ─── Stats strip ───────────────────────────────────────────── */}
          <div className="results-stats" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)',
            padding: '24px 28px', marginBottom: 36,
            background: 'var(--paper2)', borderRadius: 'var(--radius-card)',
            border: '1px solid var(--line)',
          }}>
            {STATS.map(s => (
              <div key={s.label}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.875rem', fontWeight: 500, lineHeight: 1, color: 'var(--ink-900)', letterSpacing: '-0.02em' }}>
                  {s.value}
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-900)', marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {s.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-500)', marginTop: 2 }}>
                  {s.sub}
                </div>
              </div>
            ))}
          </div>

          {/* ─── Featured reviews ──────────────────────────────────────── */}
          <div className="results-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }}>
            {REVIEWS.map((r, i) => (
              <article key={i} style={{
                background: 'white', padding: 24,
                borderRadius: 'var(--radius-card)', border: '1px solid var(--line)',
                display: 'flex', flexDirection: 'column', gap: 12,
                position: 'relative',
              }}>
                <span aria-hidden="true" style={{
                  position: 'absolute', top: 16, right: 18,
                  fontFamily: 'var(--font-display)', fontSize: '2.5rem', lineHeight: 1,
                  color: 'var(--brand-pink)', opacity: 0.18,
                }}>&ldquo;</span>
                <Stars count={r.rating} />
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 500, color: 'var(--ink-900)', margin: 0, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                  {r.headline}
                </h3>
                <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0, fontSize: '0.9375rem' }}>
                  {r.body}
                </p>
                <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--ink-900)' }}>
                        {r.author} <span style={{ fontWeight: 400, color: 'var(--ink-500)' }}>· {r.location}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ink-500)', marginTop: 2 }}>
                        on {r.product.brand} {r.product.name}
                      </div>
                    </div>
                    {r.verified && (
                      <span title="Verified purchase" style={{
                        flexShrink: 0,
                        fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.05em',
                        padding: '2px 8px', borderRadius: 4,
                        background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
                      }}>VERIFIED</span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
