import Link from 'next/link';

// One-swipe category entry directly under the trust bar. The analytics
// audit showed browse intent (/shop is the top next-page) but essentially
// zero homepage-to-category navigation — every category affordance sat
// six sections deep behind a hamburger. This puts the eight highest-intent
// destinations one thumb-flick from the hero. The image CategoryTiles and
// the full 21-chip list further down stay for SEO/internal-link value.
const CHIPS: { label: string; href: string }[] = [
  { label: 'New In', href: '/shop?sort=newest' },
  { label: 'Best Sellers', href: '/collection/bestsellers' },
  { label: 'Makeup', href: '/shop?taxon=makeup' },
  { label: 'Skincare', href: '/shop?taxon=skincare' },
  { label: 'Wellness', href: '/shop?taxon=wellness' },
  { label: 'Value Sets', href: '/collection/combos-bundles' },
  { label: 'Under PKR 2,000', href: '/collection/under-2000' },
  { label: 'On Sale', href: '/collection/on-sale' },
];

export function CategoryChipStrip() {
  return (
    <nav aria-label="Popular destinations" style={{ borderBottom: '1px solid var(--line)', background: 'var(--paper)' }}>
      <style>{`
        .home-chip-strip {
          display: flex; gap: 8px; overflow-x: auto; padding: 12px var(--side);
          scroll-snap-type: x proximity; scrollbar-width: none; -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
        }
        .home-chip-strip::-webkit-scrollbar { display: none; }
        .home-chip-strip a {
          flex: 0 0 auto; scroll-snap-align: start; white-space: nowrap;
          padding: 8px 16px; border: 1px solid var(--line); border-radius: 999px;
          background: var(--paper2, #faf6ee); color: var(--ink-700);
          font-size: 0.8125rem; font-weight: 600; text-decoration: none;
        }
        .home-chip-strip a:first-child {
          /* --brand-pink-cta, not --brand-pink: the chip carries white text and
           * the decorative pink fails WCAG AA at this size (3.7:1 < 4.5:1). */
          background: var(--brand-pink-cta, #C5286A); border-color: var(--brand-pink-cta, #C5286A); color: #fff;
        }
      `}</style>
      <div className="home-chip-strip">
        {CHIPS.map(c => (
          <Link key={c.label} href={c.href}>{c.label}</Link>
        ))}
      </div>
    </nav>
  );
}
