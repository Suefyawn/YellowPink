import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import type { BrandLogoEntry } from '@/lib/brands';
import { brandSlug } from '@/lib/brands';

// "Shop by brand" carousel. Two jobs: brand shoppers (a big slice of PK
// beauty search: "rivaj uk", "saeed ghani products", "conatural" are among
// the store's highest-volume ranking keywords) get a direct route from the
// homepage instead of digging through the footer, and the /brand/<slug>
// archive pages, which carry those rankings, get sitewide internal links.
//
// Owner call (7 Aug 2026): trending brands lead (the caller passes a
// momentum-sorted list) and the grid became a continuous marquee. Pure CSS:
// the list renders twice and the track translates -50%, so the loop is
// seamless with no client JS. Hover/focus pauses it; prefers-reduced-motion
// turns it into a plain swipeable row (see .brand-carousel in globals.css).
// The duplicate set is aria-hidden and untabbable so screen readers and
// keyboards see each brand once.
export function BrandStrip({ brands }: { brands: BrandLogoEntry[] }) {
  if (brands.length === 0) return null;
  const loop = brands.length > 2 ? [...brands, ...brands] : brands;
  const animate = brands.length > 2;
  return (
    <section style={{ padding: '72px 0', background: 'var(--paper, #fff)' }}>
      <div style={{ textAlign: 'center', marginBottom: 36, padding: '0 var(--side)' }}>
        <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>
          The names you ask for
        </Overline>
        <h2 className="display-lg" style={{ margin: 0 }}>Shop by brand</h2>
        <p className="body-text" style={{ color: 'var(--ink-600)', margin: '12px auto 0', maxWidth: 560 }}>
          Original stock from the brands Pakistan searches for most, local favourites and
          international lines alike, every item sourced and checked by us.
        </p>
      </div>
      <div className={animate ? 'brand-carousel' : 'brand-carousel brand-carousel-static'}>
        <div
          className="brand-carousel-track"
          // One full set scrolls past in ~4.5s per brand; slow enough to read,
          // alive enough to invite a look at what's next.
          style={{ ['--brand-marquee-dur' as never]: `${brands.length * 4.5}s` }}
        >
          {loop.map((b, i) => {
            const dupe = i >= brands.length;
            return (
              <Link
                key={`${b.name}-${i}`}
                href={`/brand/${brandSlug(b.name)}`}
                aria-hidden={dupe || undefined}
                tabIndex={dupe ? -1 : undefined}
                className="brand-carousel-tile"
              >
                {b.logoUrl ? (
                  // Plain <img> over the optimizer: the wall assets are already
                  // uniform 560x200 area-normalized canvases (2x for retina, see
                  // public/brands/wall/), so every logo renders the same box.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.logoUrl} alt={b.name} loading="lazy" style={{ maxWidth: '86%', maxHeight: 48, objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-800)', textAlign: 'center' }}>
                    {b.name}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 28 }}>
        <Link href="/brands" className="btn-secondary" style={{ display: 'inline-block', padding: '11px 26px' }}>
          All brands
        </Link>
      </div>
    </section>
  );
}
