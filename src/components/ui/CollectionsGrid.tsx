import Link from 'next/link';
import Image from 'next/image';
import type { Collection } from '@/lib/collections';

// Editorial collection cards. Each links to /collection/[slug]; a hero image
// fills the card when set, otherwise a soft brand gradient stands in. Shared
// by the homepage "Shop by collection" section and the /collections index.
export function CollectionsGrid({ collections }: { collections: Pick<Collection, 'slug' | 'title' | 'description' | 'hero_image_url'>[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }} className="product-grid">
      {collections.map(c => (
        <Link
          key={c.slug}
          href={`/collection/${c.slug}`}
          style={{
            position: 'relative', display: 'block', overflow: 'hidden',
            borderRadius: 'var(--radius-card)', border: '1px solid var(--line)',
            aspectRatio: '4 / 3', textDecoration: 'none', color: 'inherit',
          }}
        >
          {c.hero_image_url ? (
            <Image src={c.hero_image_url} alt="" fill sizes="(max-width: 900px) 100vw, 33vw" style={{ objectFit: 'cover' }} />
          ) : (
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(140deg, #fde7f0 0%, #faf6ee 55%, #fff8e1 100%)' }} />
          )}
          {/* Legibility wash — a full-height gradient (not just a bottom lip)
              so the white title stays readable over light hero photography. */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(20,12,16,0.18) 0%, rgba(20,12,16,0.34) 50%, rgba(20,12,16,0.74) 100%)' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '18px 20px' }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.25rem', color: '#fff', letterSpacing: '-0.01em' }}>
              {c.title}
            </h3>
            {c.description && (
              <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.86)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {c.description}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
