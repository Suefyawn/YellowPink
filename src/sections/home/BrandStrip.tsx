import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import type { BrandLogoEntry } from '@/lib/brands';
import { brandSlug } from '@/lib/brands';

// "Shop by brand" tiles. Two jobs: brand shoppers (a big slice of PK beauty
// search: "rivaj uk", "saeed ghani products", "conatural" are among the
// store's highest-volume ranking keywords) get a direct route from the
// homepage instead of digging through the footer, and the /brand/<slug>
// archive pages, which carry those rankings, finally get sitewide internal
// links instead of a single mention on /brands (Semrush flagged the brand
// surfaces as one-link pages).
export function BrandStrip({ brands }: { brands: BrandLogoEntry[] }) {
  if (brands.length === 0) return null;
  return (
    <section style={{ padding: '72px var(--side)', background: 'var(--paper, #fff)' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>
            The names you ask for
          </Overline>
          <h2 className="display-lg" style={{ margin: 0 }}>Shop by brand</h2>
          <p className="body-text" style={{ color: 'var(--ink-600)', margin: '12px auto 0', maxWidth: 560 }}>
            Original stock from the brands Pakistan searches for most, local favourites and
            international lines alike, every item sourced and checked by us.
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12,
          }}
        >
          {brands.map(b => (
            <Link
              key={b.name}
              href={`/brand/${brandSlug(b.name)}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: 84, padding: '18px 16px', borderRadius: 12,
                border: '1px solid var(--ink-100, #eee)', background: 'white',
                textDecoration: 'none',
              }}
            >
              {b.logoUrl ? (
                // Same rationale as the hero marquee: tiny logos of varied
                // aspect ratio, plain <img> beats a fixed-size optimizer.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logoUrl} alt={b.name} loading="lazy" style={{ maxWidth: '80%', maxHeight: 40, objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-800)', textAlign: 'center' }}>
                  {b.name}
                </span>
              )}
            </Link>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link href="/brands" className="btn-secondary" style={{ display: 'inline-block', padding: '11px 26px' }}>
            All brands
          </Link>
        </div>
      </div>
    </section>
  );
}
