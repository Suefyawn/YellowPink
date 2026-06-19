'use client';

import Link from 'next/link';
import Image from 'next/image';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import { K_BEAUTY_BRAND_INFO, K_BEAUTY_FAQ, kBeautyBrandShopUrl } from '@/lib/k-beauty';
import type { Product } from '@/types';

// Campaign imagery lives in /public/k-beauty — purpose-made editorial shots
// on the brand's cream/blush palette, so the page doesn't depend on which
// product photos happen to be in the catalog.
const HERO_IMG = '/k-beauty/hero.webp';
const RITUAL_IMG = '/k-beauty/ritual.webp';

// The three-step Korean routine the edit is built around. Copy, not data.
const RITUAL_STEPS = [
  {
    n: '01',
    title: 'Cleanse, gently',
    desc: 'Low-pH cleansing that respects the skin barrier instead of stripping it — the foundation of every Korean routine.',
  },
  {
    n: '02',
    title: 'Treat & layer',
    desc: 'Ampoules and essences with fermented rice, centella and fruit actives, layered thin so skin drinks them in.',
  },
  {
    n: '03',
    title: 'Protect, daily',
    desc: 'Featherweight SPF 50+ PA++++ every single morning — no white cast, no excuses. The real secret to glass skin.',
  },
];

function BrandCard({ name, tagline, blurb }: { name: string; tagline: string; blurb: string }) {
  return (
    <Link
      href={kBeautyBrandShopUrl(name)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        textDecoration: 'none', color: 'inherit',
        padding: '26px 24px', background: '#fff',
        borderRadius: 'var(--radius-card)', border: '1px solid var(--line)',
        transition: 'border-color 180ms ease-out, box-shadow 180ms ease-out',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--brand-pink)';
        e.currentTarget.style.boxShadow = '0 6px 24px rgba(197, 40, 106, 0.08)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--line)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div aria-hidden="true" style={{ width: 24, height: 4, background: 'var(--brand-yellow)', borderRadius: 2 }} />
      <h3 style={{
        fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.015em',
        fontSize: '1.25rem', margin: 0,
      }}>
        {name}
      </h3>
      <div style={{
        fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--brand-pink-text)',
      }}>
        {tagline}
      </div>
      <p className="small-text" style={{ margin: 0, lineHeight: 1.55 }}>{blurb}</p>
      <span className="text-link" style={{ marginTop: 'auto', paddingTop: 6 }}>Shop {name}</span>
    </Link>
  );
}

export function KBeautyCollection({ products }: { products: Product[] }) {
  return (
    <>
      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', minHeight: 'clamp(420px, 56vh, 620px)' }}>
          <Image
            src={HERO_IMG}
            alt="Korean skincare — serums, ampoules and SPF on a cream stone counter"
            fill
            priority
            sizes="100vw"
            style={{ objectFit: 'cover', objectPosition: 'center 40%' }}
          />
          {/* Left-to-right wash so the copy stays legible over the photo. */}
          <div aria-hidden="true" style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, rgba(250,246,238,0.92) 0%, rgba(250,246,238,0.72) 38%, rgba(250,246,238,0.05) 75%)',
          }} />
          <div className="container" style={{
            position: 'relative', display: 'flex', flexDirection: 'column',
            justifyContent: 'center', minHeight: 'clamp(420px, 56vh, 620px)',
            paddingTop: 48, paddingBottom: 48,
          }}>
            <div style={{ maxWidth: 520 }}>
              <Overline style={{ display: 'block', marginBottom: 14, color: 'var(--ink-700)' }}>
                서울의 글로우 — The Seoul Glow
              </Overline>
              <h1 className="display-l" style={{ fontSize: 'clamp(2.4rem, 5.5vw, 3.5rem)', marginBottom: 16, lineHeight: 1.05 }}>
                Korean beauty,<br />
                <em style={{ fontStyle: 'italic', color: 'var(--brand-pink-text)' }}>delivered to Pakistan.</em>
              </h1>
              <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 28, maxWidth: 440 }}>
                The formulas behind glass skin — fermented rice, single-origin centella,
                featherweight SPF — imported sealed and authentic, with COD nationwide.
              </p>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <a href="#k-beauty-products" className="btn-primary">Shop the Edit</a>
                <Link href="/shop" className="btn-secondary">Browse Everything</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Brand spotlights ──────────────────────────────────────────── */}
      <section style={{ padding: 'var(--section-gap) 0', background: 'linear-gradient(160deg, #fdf0f4 0%, var(--paper2, #faf6ee) 75%)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <div style={{ marginBottom: 36, maxWidth: 560 }}>
            <Overline style={{ display: 'block', marginBottom: 10, color: 'var(--ink-500)' }}>The Houses of the Edit</Overline>
            <h2 className="display-l" style={{ fontSize: '2.25rem', margin: 0 }}>
              {K_BEAUTY_BRAND_INFO.length} brands, <em style={{ fontStyle: 'italic' }}>hand-picked.</em>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }} className="product-grid-3">
            {K_BEAUTY_BRAND_INFO.map(b => <BrandCard key={b.name} {...b} />)}
          </div>
        </div>
      </section>

      {/* ─── The ritual ────────────────────────────────────────────────── */}
      <section style={{ padding: 'var(--section-gap) 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '5fr 6fr', gap: 56, alignItems: 'center' }} className="duo-grid">
            <div style={{ position: 'relative', borderRadius: 'var(--radius-card)', overflow: 'hidden', aspectRatio: '3/4' }}>
              <Image
                src={RITUAL_IMG}
                alt="Dewy glass skin — applying a centella ampoule"
                fill
                sizes="(max-width: 900px) 100vw, 42vw"
                style={{ objectFit: 'cover' }}
              />
            </div>
            <div>
              <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Why K-Beauty</Overline>
              <h2 className="display-l" style={{ fontSize: '2.25rem', marginBottom: 14 }}>
                Skin first.<br /><em style={{ fontStyle: 'italic' }}>Makeup second.</em>
              </h2>
              <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 28, maxWidth: 460 }}>
                Korean skincare isn&apos;t about covering skin — it&apos;s about building it:
                gentle formulas, thin layers, and religious sun protection, until skin
                looks lit from within.
              </p>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {RITUAL_STEPS.map(s => (
                  <li key={s.n} style={{ display: 'flex', gap: 18 }}>
                    <span aria-hidden="true" style={{
                      fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 600,
                      fontSize: '1.5rem', color: 'var(--brand-pink-text)', lineHeight: 1.2,
                      minWidth: 40,
                    }}>
                      {s.n}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: 3 }}>{s.title}</div>
                      <div className="small-text" style={{ lineHeight: 1.55, maxWidth: 420 }}>{s.desc}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Product grid ──────────────────────────────────────────────── */}
      <section id="k-beauty-products" style={{ paddingBottom: 'var(--section-gap)', scrollMarginTop: 90 }}>
        <div className="container">
          <SectionDivider />
          <div style={{ marginTop: 'var(--section-gap)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
              <div>
                <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Shop the Edit</Overline>
                <h2 className="display-l" style={{ fontSize: '2.25rem', margin: 0 }}>
                  Every Korean pick, <em style={{ fontStyle: 'italic' }}>in stock.</em>
                </h2>
              </div>
              <span className="small-text">{products.length} {products.length === 1 ? 'product' : 'products'}</span>
            </div>
            {products.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }} className="product-grid">
                {products.map(p => <ProductTile key={p.id} product={p} />)}
              </div>
            ) : (
              // The edit is data-driven; if every K-beauty product is ever
              // unpublished the grid degrades to a pointer, not a dead end.
              <p className="body-text" style={{ color: 'var(--ink-700)' }}>
                The Korean shelf is restocking — <Link href="/shop" className="text-link">browse the full catalog</Link> in the meantime.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ─── FAQ ───────────────────────────────────────────────────────── */}
      <section style={{ paddingBottom: 'var(--section-gap)' }}>
        <div className="container">
          <div style={{ maxWidth: 720 }}>
            <Overline style={{ display: 'block', marginBottom: 10, color: 'var(--ink-500)' }}>Good to Know</Overline>
            <h2 className="display-l" style={{ fontSize: '1.75rem', marginBottom: 20 }}>K-Beauty, answered.</h2>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {K_BEAUTY_FAQ.map(f => (
                <details key={f.question} style={{ borderTop: '1px solid var(--line)', padding: '16px 0' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9375rem' }}>{f.question}</summary>
                  <p className="body-text" style={{ color: 'var(--ink-700)', margin: '10px 0 0', maxWidth: 640 }}>{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
