'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProductImage } from '@/components/ui/ProductImage';
import { Overline } from '@/components/ui/Overline';
import { StarRating } from '@/components/ui/StarRating';
import { brandPlusName } from '@/lib/product-display';
import { useCart } from '@/context/CartContext';
import { RETURNS_WINDOW_DAYS } from '@/lib/commerce';
import { track } from '@/lib/analytics';
import type { Product } from '@/types';

// Buyable product module injected high in a blog post (right after the intro).
// The blog is the store's biggest entry surface and PostHog shows ~90% of the
// view→cart funnel leaking before a PDP is ever reached — so this module has
// to do the PDP's selling in place, not just link out. The FIRST pick (the
// product the guide is actually about, per lib/related-products link order)
// gets a hero treatment: bigger image, star rating, one-line benefit and a
// filled Add to Cart. Remaining picks keep the original compact row.
// Client component for the cart hook; renders in the SSR HTML as before.
export function BlogProductNudge({ products, label = 'Recommended in this guide' }: { products: Product[]; label?: string }) {
  const { addToCart } = useCart();
  const router = useRouter();
  const [addedId, setAddedId] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const seenRef = useRef(false);
  // Only pitch what a reader can actually buy right now.
  const picks = products
    .filter(p => !(p.track_inventory !== false && typeof p.stock === 'number' && p.stock <= 0))
    .slice(0, 3);

  // Impression tracking: fire once when the module first scrolls into view,
  // so module views can be compared against the adds it drives.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || picks.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !seenRef.current) {
        seenRef.current = true;
        track({ name: 'view_item_list', payload: { list: 'Blog Buy Module', product_ids: picks.map(p => p.id) } });
        io.disconnect();
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
    // picks derives from the products prop, stable per post render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (picks.length === 0) return null;
  const [hero, ...rest] = picks;

  const handleAdd = (p: Product, source: string) => {
    // Variable products need a shade/size choice — send those to the PDP.
    if (p.kind === 'variable') {
      router.push(`/product/${p.slug}`);
      return;
    }
    if (addToCart({ ...p, qty: 1 }, { source })) {
      setAddedId(p.id);
      window.setTimeout(() => setAddedId(null), 1400);
    }
  };

  const pill = (p: Product, filled: boolean, source: string) => (
    <button
      type="button"
      onClick={() => handleAdd(p, source)}
      aria-label={p.kind === 'variable' ? `Choose options for ${p.name}` : `Add ${p.name} to cart`}
      style={{
        flexShrink: 0, minHeight: 40, padding: filled ? '10px 20px' : '8px 12px',
        background: addedId === p.id || filled ? 'var(--brand-pink-cta, #C5286A)' : 'transparent',
        color: addedId === p.id || filled ? '#fff' : 'var(--brand-pink-cta, #C5286A)',
        border: '1px solid var(--brand-pink-cta, #C5286A)', borderRadius: 'var(--radius-pill)',
        fontFamily: 'var(--font-ui)', fontSize: '0.6875rem', fontWeight: 700,
        letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
        whiteSpace: 'nowrap', transition: 'background 200ms, color 200ms',
      }}
    >
      {addedId === p.id
        ? 'Added ✓'
        : p.kind === 'variable'
          ? (filled ? 'Choose options' : 'Options')
          : (filled ? 'Add to cart' : 'Add')}
    </button>
  );

  return (
    <aside
      ref={rootRef}
      className="blog-product-nudge"
      style={{
        margin: '28px 0', padding: '18px 18px 16px',
        background: 'var(--paper2, #faf6ee)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      <Overline style={{ display: 'block', marginBottom: 14, color: 'var(--brand-pink-text)' }}>
        {label}
      </Overline>

      {/* Hero pick: the product the guide is about. */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <Link
          href={`/product/${hero.slug}`}
          onClick={() => track({ name: 'select_item', payload: { product_id: hero.id, product_name: hero.name, list: 'Blog Buy Module' } })}
          style={{ flexShrink: 0, display: 'block', width: 96, height: 96, borderRadius: 10, overflow: 'hidden', background: '#fff', border: '1px solid var(--line)' }}
        >
          <ProductImage src={hero.image_url} alt={brandPlusName(hero.brand, hero.name)} sizes="96px" />
        </Link>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Link
            href={`/product/${hero.slug}`}
            onClick={() => track({ name: 'select_item', payload: { product_id: hero.id, product_name: hero.name, list: 'Blog Buy Module' } })}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <span style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink-900)', lineHeight: 1.3 }}>
              {brandPlusName(hero.brand, hero.name)}
            </span>
          </Link>
          {(hero.review_count ?? 0) > 0 && (
            <div style={{ marginTop: 4 }}>
              <StarRating rating={hero.rating} count={hero.review_count} size={12} />
            </div>
          )}
          {hero.short_description && (
            <p style={{
              margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--ink-700)', lineHeight: 1.5,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {hero.short_description}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--ink-900)' }} className="tabular-nums">
              PKR {hero.price.toLocaleString()}
              {(hero.original_price ?? 0) > hero.price && (
                <span style={{ marginLeft: 8, textDecoration: 'line-through', color: 'var(--ink-500)', fontSize: '0.8125rem', fontWeight: 400 }}>
                  PKR {(hero.original_price ?? 0).toLocaleString()}
                </span>
              )}
            </span>
            {pill(hero, true, 'blog_nudge_hero')}
            <Link
              href={`/product/${hero.slug}`}
              onClick={() => track({ name: 'select_item', payload: { product_id: hero.id, product_name: hero.name, list: 'Blog Buy Module' } })}
              style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-700)', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              View details
            </Link>
          </div>
        </div>
      </div>

      {/* Secondary picks keep the compact row. */}
      {rest.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: rest.length > 1 ? 'repeat(2, 1fr)' : '1fr', gap: 12, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }} className="blog-nudge-grid">
          {rest.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Link
                href={`/product/${p.slug}`}
                onClick={() => track({ name: 'select_item', payload: { product_id: p.id, product_name: p.name, list: 'Blog Buy Module' } })}
                style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}
              >
                <div style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: '#fff', border: '1px solid var(--line)' }}>
                  <ProductImage src={p.image_url} alt={brandPlusName(p.brand, p.name)} sizes="56px" />
                </div>
                <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-900)', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {brandPlusName(p.brand, p.name)}
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--ink-700)' }}>
                    <span style={{ fontWeight: 600 }} className="tabular-nums">PKR {p.price.toLocaleString()}</span>
                    {(p.original_price ?? 0) > p.price && (
                      <span style={{ marginLeft: 6, textDecoration: 'line-through', color: 'var(--ink-500)', fontSize: '0.75rem' }}>
                        PKR {(p.original_price ?? 0).toLocaleString()}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
              {pill(p, false, 'blog_nudge')}
            </div>
          ))}
        </div>
      )}

      <p className="small-text" style={{ margin: '12px 0 0', color: 'var(--ink-700)', fontSize: '0.75rem' }}>
        Cash on delivery nationwide · {RETURNS_WINDOW_DAYS}-day returns on unopened items
      </p>
    </aside>
  );
}
