'use client';

import Link from 'next/link';
import Image from 'next/image';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import { formatPkr } from '@/lib/commerce';
import type { WellnessConcern } from '@/lib/wellness-data';
import type { Product } from '@/types';

// Inline lucide-style icons (24×24, currentColor, strokeWidth 2) keyed by the
// concern `key` from wellness-data. Per the project icon guidance we never use
// emoji for these — they pick up the OS emoji font and clash with the brand.
const ICON_PATHS: Record<string, React.ReactNode> = {
  'womens-health': <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />,
  'mens-health': <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />,
  immunity: <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" />,
  'bone-joint': <path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z" />,
  'heart-health': <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />,
  'digestive-gut': <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6" /></>,
  respiratory: <><path d="M12.8 19.6A2 2 0 1 0 14 16H2" /><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" /><path d="M9.8 4.4A2 2 0 1 1 11 8H2" /></>,
  kids: <><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" x2="9.01" y1="9" y2="9" /><line x1="15" x2="15.01" y1="9" y2="9" /></>,
};

function ConcernIcon({ k }: { k: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[k] ?? ICON_PATHS.immunity}
    </svg>
  );
}

// Wellness-specific assurances — supplement buyers care about authenticity and
// safety (sealed, in-date) more than makeup buyers, so this strip speaks to
// that anxiety rather than repeating the generic storefront TrustBar.
const ASSURANCES: { title: string; sub: string; icon: React.ReactNode }[] = [
  { title: '100% authentic', sub: 'Imported & batch-verified', icon: <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" /> },
  { title: 'Sealed & in-date', sub: 'Expiry checked before dispatch', icon: <><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" /><path d="m9 16 2 2 4-4" /></> },
  { title: 'Cash on delivery', sub: 'Pay when it reaches you', icon: <><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></> },
  { title: 'Discreet delivery', sub: 'Plain packaging, nationwide', icon: <><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></> },
];

export function WellnessSection({
  concerns,
  rail,
  totalCount,
}: {
  concerns: WellnessConcern[];
  rail: Product[];
  totalCount: number;
}) {
  // Nothing published in wellness → hide the whole section rather than render
  // an empty shell (mirrors the other self-hiding home rails).
  if (concerns.length === 0 || rail.length === 0) return null;
  const railItems = rail.slice(0, 4);

  return (
    <section style={{ padding: 'var(--section-gap) 0' }}>
      <div className="container">
        <SectionDivider />

        {/* Editorial intro — copy on the left, atmospheric still life on the
            right, so the section opens with weight instead of a bare heading. */}
        <div
          className="duo-grid"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', marginTop: 'var(--section-gap)' }}
        >
          <div>
            <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Beyond Beauty · Wellness</Overline>
            <h2 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 16 }}>
              Beauty starts<br /><em style={{ fontStyle: 'italic' }}>from within.</em>
            </h2>
            <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 440, marginBottom: 20 }}>
              Clinical-grade nutraceuticals for fertility, immunity, bone health and daily
              vitality — the same authenticity standard as everything else on Yellow Pink.
              Because real beauty is health, inside out.
            </p>
            <p className="small-text" style={{ color: 'var(--ink-500)', marginBottom: 24 }}>
              {totalCount} supplements across {concerns.length} health concerns · imported &amp; batch-verified
            </p>
            <Link href="/shop?taxon=wellness" className="btn-primary">Explore all Wellness</Link>
          </div>

          <div style={{ position: 'relative', borderRadius: 'var(--radius-card)', overflow: 'hidden', aspectRatio: '4 / 3' }}>
            <Image
              src="/wellness/wellness-editorial.webp"
              alt="Amber supplement bottles with fresh ginger, citrus and herbs on warm linen"
              fill
              sizes="(max-width: 900px) 100vw, 50vw"
              style={{ objectFit: 'cover' }}
            />
            <span style={{
              position: 'absolute', left: 14, bottom: 14,
              background: 'rgba(255,255,255,0.92)', color: 'var(--ink-900, #1a1a1a)',
              borderRadius: 'var(--radius-pill, 999px)', padding: '6px 14px',
              fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              backdropFilter: 'blur(4px)',
            }}>
              100% authentic · expiry-checked
            </span>
          </div>
        </div>

        {/* Shop by concern — all eight, with live counts + from-prices, so the
            range reads as a considered catalogue rather than four taglines. */}
        <div style={{ marginTop: 'var(--section-gap)' }}>
          <Overline style={{ display: 'block', marginBottom: 16, color: 'var(--ink-500)' }}>Shop by health concern</Overline>
          <div className="wellness-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }}>
            {concerns.map((c) => (
              <Link
                key={c.key}
                href={c.href}
                className="wellness-concern"
                style={{
                  display: 'flex', flexDirection: 'column', gap: 8,
                  padding: '18px 18px 20px', background: 'var(--paper2)',
                  borderRadius: 'var(--radius-card)', border: '1px solid var(--line)',
                  textDecoration: 'none', color: 'inherit',
                  transition: 'border-color 180ms ease-out, transform 180ms ease-out',
                }}
              >
                <span style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: 'var(--brand-yellow-soft, #fdf2cc)', color: 'var(--ink-900, #1a1a1a)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ConcernIcon k={c.key} />
                </span>
                <span style={{ fontSize: '0.9375rem', fontWeight: 600, marginTop: 2 }}>{c.label}</span>
                <span className="small-text" style={{ lineHeight: 1.4, color: 'var(--ink-500)' }}>{c.tagline}</span>
                <span style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span className="small-text" style={{ color: 'var(--ink-700)' }}>
                    {c.count} {c.count === 1 ? 'product' : 'products'}
                  </span>
                  {c.fromPrice !== null && (
                    <span className="small-text" style={{ fontWeight: 600 }}>from {formatPkr(c.fromPrice)}</span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Featured wellness picks. */}
        <div style={{ marginTop: 'var(--section-gap)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
            <Overline style={{ color: 'var(--ink-500)' }}>Wellness bestsellers</Overline>
            <Link href="/shop?taxon=wellness" className="text-link">View all →</Link>
          </div>
          <div className="product-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }}>
            {railItems.map((p) => <ProductTile key={p.id} product={p} />)}
          </div>
        </div>

        {/* Wellness assurances. */}
        <div className="trust-grid" style={{ marginTop: 'var(--section-gap)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {ASSURANCES.map((a) => (
            <div key={a.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ color: 'var(--brand-pink-text, #C5286A)', flexShrink: 0, marginTop: 2 }} aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {a.icon}
                </svg>
              </span>
              <span>
                <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600 }}>{a.title}</span>
                <span className="small-text" style={{ color: 'var(--ink-500)' }}>{a.sub}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .wellness-concern:hover { border-color: var(--brand-yellow) !important; transform: translateY(-2px); }
      `}</style>
    </section>
  );
}
