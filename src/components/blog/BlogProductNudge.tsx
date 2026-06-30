import Link from 'next/link';
import { ProductImage } from '@/components/ui/ProductImage';
import { Overline } from '@/components/ui/Overline';
import { brandPlusName } from '@/lib/product-display';
import type { Product } from '@/types';

// Compact "shop the products in this guide" card, injected high in a blog post
// (right after the intro). Most blog landings are single-page visits that
// bounce before reaching the bottom "Mentioned in this article" rail, so this
// puts a buyable, visual product nudge above the fold for researchers. Server
// component: links straight to the PDP (no client add-to-cart needed here).
export function BlogProductNudge({ products }: { products: Product[] }) {
  const picks = products.slice(0, 2);
  if (picks.length === 0) return null;

  return (
    <aside
      style={{
        margin: '28px 0', padding: '16px 18px',
        background: 'var(--paper2, #faf6ee)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--brand-pink-text)' }}>
        {picks.length > 1 ? 'Recommended in this guide' : 'Recommended in this guide'}
      </Overline>
      <div style={{ display: 'grid', gridTemplateColumns: picks.length > 1 ? 'repeat(2, 1fr)' : '1fr', gap: 12 }} className="blog-nudge-grid">
        {picks.map(p => (
          <Link
            key={p.id}
            href={`/product/${p.slug}`}
            style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: '#fff', border: '1px solid var(--line)' }}>
              <ProductImage src={p.image_url} alt={brandPlusName(p.brand, p.name)} sizes="64px" />
            </div>
            <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-900)', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {brandPlusName(p.brand, p.name)}
              </span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--ink-700)' }}>
                <span style={{ fontWeight: 600 }}>PKR {p.price.toLocaleString()}</span>
                {(p.original_price ?? 0) > p.price && (
                  <span style={{ marginLeft: 6, textDecoration: 'line-through', color: 'var(--ink-500)', fontSize: '0.75rem' }}>
                    PKR {(p.original_price ?? 0).toLocaleString()}
                  </span>
                )}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-pink-text, #9d174d)' }}>Shop now →</span>
            </span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
