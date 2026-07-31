'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProductImage } from '@/components/ui/ProductImage';
import { brandPlusName } from '@/lib/product-display';
import { useCart } from '@/context/CartContext';
import { track } from '@/lib/analytics';
import type { Product } from '@/types';

// Mobile sticky buy bar for single-product guide posts (the Trimo-M /
// Artibro / collagen deep-dives that dominate blog traffic). Long articles
// put the in-body buy module thousands of pixels behind the reader by the
// time they're convinced; the PDP solved the same problem with its sticky
// bar, so the blog gets the equivalent: once the in-body module scrolls off
// the top, a slim bar with the guide's product pins to the bottom edge.
// Mobile-only via the `blog-sticky-buy` class (display:none ≥769px in
// globals.css). Rendered only for products genuinely mentioned in the post —
// never for generic fallback picks.
export function BlogStickyBuyBar({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [added, setAdded] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  const seenRef = useRef(false);

  const buyable = !(product.track_inventory !== false && typeof product.stock === 'number' && product.stock <= 0);

  // Same reveal rule as the PDP sticky bar: appear once the in-body buy
  // module has scrolled off the TOP of the viewport (the reader is past it),
  // never while it's still ahead of them. Falls back to a scroll-depth
  // threshold if the module isn't on the page.
  useEffect(() => {
    if (!buyable) return;
    const nudge = document.querySelector('.blog-product-nudge');
    if (nudge && typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(
        ([entry]) => setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0),
        { threshold: 0 },
      );
      io.observe(nudge);
      return () => io.disconnect();
    }
    const onScroll = () => setShow(window.scrollY > 900);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [buyable]);

  const visible = show && !dismissed;

  // Lift the WhatsApp FAB / back-to-top above the bar while it's up (they read
  // --fab-bottom-offset), mirroring the PDP sticky bar.
  useEffect(() => {
    const root = document.documentElement;
    // Desktop hides the bar via CSS; don't reserve space for it there.
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
    if (visible && isMobile) {
      const h = barRef.current?.offsetHeight ?? 60;
      root.style.setProperty('--fab-bottom-offset', `${h + 12}px`);
      if (!seenRef.current) {
        seenRef.current = true;
        track({ name: 'view_item_list', payload: { list: 'Blog Sticky Bar', product_ids: [product.id] } });
      }
    } else {
      root.style.removeProperty('--fab-bottom-offset');
    }
    return () => { root.style.removeProperty('--fab-bottom-offset'); };
  }, [visible, product.id]);

  if (!buyable) return null;

  const handleAdd = () => {
    if (product.kind === 'variable') {
      router.push(`/product/${product.slug}`);
      return;
    }
    if (addToCart({ ...product, qty: 1 }, { source: 'blog_sticky_bar' })) {
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1400);
    }
  };

  return (
    <div
      ref={barRef}
      className="blog-sticky-buy"
      inert={!visible}
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 90,
        background: 'rgba(250,246,238,0.97)',
        backdropFilter: 'saturate(140%) blur(8px)',
        WebkitBackdropFilter: 'saturate(140%) blur(8px)',
        borderTop: '1px solid var(--line)',
        boxShadow: '0 -6px 18px rgba(0,0,0,0.06)',
        padding: '10px var(--side)',
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', alignItems: 'center', gap: 12,
        transform: visible ? 'translateY(0)' : 'translateY(110%)',
        transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: '#fff', border: '1px solid var(--line)' }}>
        <ProductImage src={product.image_url} alt={brandPlusName(product.brand, product.name)} sizes="40px" />
      </div>
      <div style={{ minWidth: 0, flex: '1 1 auto' }}>
        <div style={{
          fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-900)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{brandPlusName(product.brand, product.name)}</div>
        <div className="tabular-nums" style={{ fontSize: '0.875rem', fontWeight: 700 }}>
          PKR {product.price.toLocaleString()}
        </div>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        aria-label={product.kind === 'variable' ? `Choose options for ${product.name}` : `Add ${product.name} to cart`}
        style={{
          flexShrink: 0, minHeight: 44, padding: '10px 18px',
          background: 'var(--brand-pink-cta, #C5286A)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-pill)',
          fontFamily: 'var(--font-ui)', fontSize: '0.6875rem', fontWeight: 700,
          letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {added ? 'Added ✓' : product.kind === 'variable' ? 'Options' : 'Add to cart'}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Hide this bar"
        style={{
          flexShrink: 0, width: 32, height: 32, marginRight: -6,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--ink-500)', fontSize: '1.125rem', lineHeight: 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >×</button>
    </div>
  );
}
