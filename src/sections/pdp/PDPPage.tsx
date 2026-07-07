'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import { ProductTile } from '@/components/ui/ProductTile';
import { StarRating } from '@/components/ui/StarRating';
import { TrustStrip } from '@/components/pdp/TrustStrip';
import { useCart } from '@/context/CartContext';
import { ProductDescription } from '@/components/pdp/ProductDescription';
import { track } from '@/lib/analytics';
import { tapHaptic } from '@/lib/haptics';
import { stripBrandPrefix } from '@/lib/product-display';
import { whatsappUrl as waUrl, whatsappGoUrl, WA_TEMPLATES as WA_T } from '@/lib/whatsapp';
import { BenefitIcon } from '@/components/ui/BenefitIcon';
import { RETURNS_WINDOW_DAYS } from '@/lib/commerce';
import { useCommerceSettings } from '@/context/CommerceSettings';
import { effectiveProductFaq } from '@/lib/product-faq';
import { taxonForCategory } from '@/lib/category-taxonomy';
import { MedicalDisclaimer } from '@/components/MedicalDisclaimer';
import type { Product, ProductImage as ProductImageT, ProductAttribute, AttributeValue, ProductVariant } from '@/types';

// Brand → /brand/<slug>. Mirrors brandSlug() in lib/brands.ts, inlined to keep
// the server Supabase client (which lib/brands imports) out of this client
// bundle. Keep the two in sync.
function brandHref(brand: string): string {
  const slug = brand.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `/brand/${slug}`;
}

interface AttributeWithValues extends ProductAttribute {
  values: AttributeValue[];
}

interface VariantWithOptions extends ProductVariant {
  option_value_ids: string[];
}

interface Props {
  product: Product;
  relatedProducts?: Product[];
  variants?: VariantWithOptions[];
  attributes?: AttributeWithValues[];
  gallery?: ProductImageT[];
  /** Pre-address standard delivery estimate (working days), shown by the buy
   *  panel. Null when no shipping zone configures an ETA. */
  estimatedDays?: { min: number; max: number } | null;
  /** Loyalty points earned per PKR spent (site setting). 0 hides the
   *  "earn points" nudge. */
  pointsPerPkr?: number;
}

// ─── Variant picker ─────────────────────────────────────────────────────────
function VariantPicker({
  attributes, variants, selected, onChange,
}: {
  attributes: AttributeWithValues[];
  variants: VariantWithOptions[];
  selected: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  // Mark which attribute-values are still reachable given the current selection.
  function isReachable(attrId: string, valueId: string): boolean {
    const test = { ...selected, [attrId]: valueId };
    return variants.some(v =>
      Object.entries(test).every(([, vId]) => v.option_value_ids.includes(vId))
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
      {attributes.map(attr => {
        const selectedValueId = selected[attr.id];
        const selectedLabel = attr.values.find(v => v.id === selectedValueId)?.value;
        const hasColor = attr.values.some(v => v.color_hex);
        return (
          <div key={attr.id}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span id={`attr-label-${attr.id}`} style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-900)' }}>{attr.name}</span>
              {selectedLabel && <span style={{ fontSize: '0.8125rem', color: 'var(--ink-500)' }}>{selectedLabel}</span>}
            </div>
            {/* role=group + labelledby so AT announces the option set as e.g.
                "Shade, group" instead of a run of ungrouped toggle buttons. */}
            <div role="group" aria-labelledby={`attr-label-${attr.id}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {attr.values.map(v => {
                const reachable = isReachable(attr.id, v.id);
                const active = selectedValueId === v.id;
                if (hasColor && v.color_hex) {
                  // Swatch button
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onChange({ ...selected, [attr.id]: v.id })}
                      title={v.value}
                      disabled={!reachable && !active}
                      aria-label={v.value}
                      aria-pressed={active}
                      style={{
                        width: 34, height: 34, borderRadius: '50%',
                        border: active ? '2px solid var(--ink-900)' : '2px solid var(--line)',
                        outline: active ? '2px solid var(--paper)' : 'none',
                        outlineOffset: -4,
                        background: v.color_hex ?? '#eee',
                        cursor: reachable ? 'pointer' : 'not-allowed',
                        opacity: reachable || active ? 1 : 0.35,
                        padding: 0,
                      }}
                    />
                  );
                }
                // Pill button
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onChange({ ...selected, [attr.id]: v.id })}
                    disabled={!reachable && !active}
                    aria-pressed={active}
                    style={{
                      padding: '8px 14px',
                      border: '1px solid ' + (active ? 'var(--ink-900)' : 'var(--line)'),
                      background: active ? 'var(--ink-900)' : 'var(--paper)',
                      color: active ? 'var(--paper)' : 'var(--ink-900)',
                      borderRadius: 'var(--radius-card)',
                      fontSize: '0.8125rem',
                      cursor: reachable ? 'pointer' : 'not-allowed',
                      opacity: reachable || active ? 1 : 0.35,
                      textDecoration: !reachable && !active ? 'line-through' : 'none',
                    }}
                  >
                    {v.value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Product image gallery (horizontal slider) ─────────────────────────────
// Scroll-snap slider: swipe/scroll or use the arrows to move between shots, tap
// a thumbnail to jump. objectFit:contain so a portrait bottle shows whole (no
// crop / "zoomed-in" look), height capped so the hero never dominates the page.
// No hover-zoom. Works the same on desktop and mobile (native swipe).
const SLIDER_ARROW: React.CSSProperties = {
  position: 'absolute', top: '50%', transform: 'translateY(-50%)',
  width: 36, height: 36, borderRadius: '50%',
  background: 'rgba(255,255,255,0.92)', border: '1px solid var(--line)',
  color: 'var(--ink-900)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', zIndex: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
};

function Gallery({
  images, alt, fallback, brandLabel, videoUrl,
}: {
  images: ProductImageT[];
  alt: string;
  fallback?: string | null;
  brandLabel?: string;
  videoUrl?: string | null;
}) {
  // Ordered slide list: product images (or the fallback) + an optional trailing
  // video slide.
  const slides = useMemo(() => {
    const imgs = images.length
      ? images.map(i => ({ key: i.id, url: i.url, alt: i.alt || alt, video: false }))
      : (fallback ? [{ key: 'fallback', url: fallback, alt, video: false }] : []);
    return videoUrl
      ? [...imgs, { key: 'video', url: fallback ?? imgs[0]?.url ?? '', alt: `${alt} video`, video: true }]
      : imgs;
  }, [images, fallback, videoUrl, alt]);

  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  const goTo = (i: number) => {
    const t = trackRef.current;
    if (!t) return;
    (t.children[i] as HTMLElement | undefined)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };
  const onScroll = () => {
    const t = trackRef.current;
    if (!t) return;
    const i = Math.max(0, Math.min(slides.length - 1, Math.round(t.scrollLeft / t.clientWidth)));
    setIdx(prev => (prev === i ? prev : i));
  };

  const many = slides.length > 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 0 }}>
      <div style={{ position: 'relative' }}>
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="pdp-slider-track"
          role="group"
          aria-roledescription="carousel"
          aria-label="Product images"
          style={{
            display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
            borderRadius: 'var(--radius-card)', background: 'var(--paper2)', scrollbarWidth: 'none',
          }}
        >
          {slides.map((s, i) => (
            <div
              key={s.key}
              style={{
                flex: '0 0 100%', scrollSnapAlign: 'center',
                aspectRatio: '1 / 1', maxHeight: 440,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: s.video ? '#000' : undefined,
              }}
            >
              {s.video && videoUrl ? (
                <video
                  src={videoUrl}
                  poster={s.url || undefined}
                  controls
                  preload="none"
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <ProductImage
                  src={s.url}
                  alt={s.alt}
                  label={brandLabel}
                  fit="contain"
                  priority={i === 0}
                  sizes="(max-width: 900px) 100vw, 440px"
                />
              )}
            </div>
          ))}
        </div>
        {many && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => goTo(Math.max(0, idx - 1))}
              disabled={idx === 0}
              style={{ ...SLIDER_ARROW, left: 8, opacity: idx === 0 ? 0.35 : 1 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => goTo(Math.min(slides.length - 1, idx + 1))}
              disabled={idx === slides.length - 1}
              style={{ ...SLIDER_ARROW, right: 8, opacity: idx === slides.length - 1 ? 0.35 : 1 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </>
        )}
      </div>
      {many && (
        <div className="pdp-slider-thumbs" role="group" aria-label="Choose image" style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Image ${i + 1} of ${slides.length}`}
              aria-current={i === idx ? 'true' : undefined}
              style={{
                width: 56, height: 68, flexShrink: 0, padding: 0, position: 'relative',
                border: '1px solid ' + (i === idx ? 'var(--ink-900)' : 'var(--line)'),
                borderRadius: 'var(--radius-card)', overflow: 'hidden',
                background: 'var(--paper2)', cursor: 'pointer',
              }}
            >
              <ProductImage src={s.url} alt={s.alt} label={brandLabel} width={68} height={68} />
              {s.video && (
                <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.28)', color: '#fff' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PDPPage ───────────────────────────────────────────────────────────────
export function PDPPage({ product, relatedProducts = [], variants = [], attributes = [], gallery = [], estimatedDays = null, pointsPerPkr = 0 }: Props) {
  const [qty, setQty] = useState(1);
  const [addedFlash, setAddedFlash] = useState(false);
  // Sticky mobile buy-bar: shown once the in-page buy panel scrolls out of
  // view so the Add-to-Cart action is always one tap away on a phone.
  const buyPanelRef = useRef<HTMLDivElement | null>(null);
  const variantPickerRef = useRef<HTMLDivElement | null>(null);
  const stickyBarRef = useRef<HTMLDivElement | null>(null);
  // Brief highlight on the variant picker when the sticky bar sends a shopper
  // up to choose options, so it's obvious *what* needs picking (otherwise the
  // "Select options" tap can feel like a dead scroll).
  const [flashPicker, setFlashPicker] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const { addToCart } = useCart();
  // Free-delivery copy tracks the owner's live on/off setting. We don't state a
  // single threshold here: it varies by delivery zone and we can't know the
  // shopper's city on the PDP, so the exact figure is shown at checkout.
  const { freeShippingEnabled } = useCommerceSettings();
  // Wellness/supplement products carry a "food supplement, not a medicine"
  // disclaimer (YMYL safeguard below the description); cosmetics don't.
  const isWellness = taxonForCategory(product.category)?.key === 'wellness';
  const shippingContent = freeShippingEnabled
    ? `Free delivery on bigger orders — the exact threshold depends on your city and is shown at checkout. COD available nationwide. ${RETURNS_WINDOW_DAYS}-day return policy on unopened items.`
    : `COD available nationwide. ${RETURNS_WINDOW_DAYS}-day return policy on unopened items.`;

  // Observe the in-page buy panel; surface the sticky bar only after it has
  // scrolled off the top of the viewport (not before the user reaches it).
  useEffect(() => {
    const el = buyPanelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setShowStickyBar(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // While the sticky buy-bar is up, lift the global floating buttons (WhatsApp
  // FAB + back-to-top) above it via a CSS var they read, so they don't overlap
  // the bar on mobile. Cleared when the bar hides or the PDP unmounts.
  useEffect(() => {
    const root = document.documentElement;
    if (showStickyBar) {
      const h = stickyBarRef.current?.offsetHeight ?? 68;
      root.style.setProperty('--fab-bottom-offset', `${h + 12}px`);
    } else {
      root.style.removeProperty('--fab-bottom-offset');
    }
    return () => { root.style.removeProperty('--fab-bottom-offset'); };
  }, [showStickyBar]);

  // view_item analytics, fires once per product visit.
  useEffect(() => {
    track({
      name: 'view_item',
      payload: {
        product_id:   product.id,
        product_name: product.name,
        brand:        product.brand ?? undefined,
        category:     product.category,
        price:        product.price,
        currency:     'PKR',
      },
    });
  }, [product.id, product.name, product.brand, product.category, product.price]);

  // Pin every product page to the top. A client-side navigation from a
  // scrolled-down homepage / collection page (common on mobile) can hand the
  // PDP a stale scroll position, landing the viewport on the footer.
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.location.hash) {
      window.scrollTo(0, 0);
    }
  }, [product.id]);

  // Default-select the first reachable value for every attribute (or none).
  // This runs once per mount; the page remounts on product→product navigation
  // because PDPPage is keyed on the product id in the route (see
  // /product/[slug]/page.tsx), so a new product always re-defaults cleanly.
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (variants.length > 0 && attributes.length > 0) {
      // Try to pick a fully-defining first variant.
      const first = variants[0];
      for (const attr of attributes) {
        const match = attr.values.find(v => first.option_value_ids.includes(v.id));
        if (match) init[attr.id] = match.id;
      }
    }
    return init;
  });

  // Resolve the currently-matching variant (if all attributes have a selection).
  const activeVariant = useMemo(() => {
    if (variants.length === 0) return null;
    const need = attributes.length;
    const have = Object.values(selected).filter(Boolean).length;
    if (need > 0 && have < need) return null;
    return variants.find(v =>
      Object.values(selected).every(vId => v.option_value_ids.includes(vId))
    ) ?? null;
  }, [variants, attributes, selected]);

  const allAttrsSelected = attributes.length === 0 || attributes.every(a => Boolean(selected[a.id]));

  // Display values derive from the active variant when set, else from the product.
  const displayPrice          = activeVariant?.price ?? product.price;
  const displayOriginal       = activeVariant?.compare_at_price ?? product.original_price ?? null;
  const displayStock          = activeVariant?.stock ?? product.stock;
  const displayImageOverride  = activeVariant?.image_url ?? null;
  // Loyalty nudge, points earned for the current price × quantity. Mirrors
  // the server-side earn trigger (points_per_pkr) so the figure matches what
  // actually lands in the customer's balance after the order.
  const pointsEarned = pointsPerPkr > 0 ? Math.round(displayPrice * qty * pointsPerPkr) : 0;

  // Build gallery: if the variant has its own image, slot it in as the first thumbnail.
  const galleryToShow: ProductImageT[] = useMemo(() => {
    if (!displayImageOverride) return gallery;
    const synth: ProductImageT = {
      id: 'variant-image',
      product_id: product.id,
      variant_id: activeVariant?.id ?? null,
      url: displayImageOverride,
      alt: product.name,
      sort_order: -1,
    };
    return [synth, ...gallery.filter(g => g.url !== displayImageOverride)];
  }, [displayImageOverride, gallery, activeVariant, product]);

  const variantLabel = activeVariant && attributes.length
    ? attributes
        .map(a => {
          const valId = selected[a.id];
          const val = a.values.find(v => v.id === valId);
          return val ? `${a.name}: ${val.value}` : null;
        })
        .filter(Boolean)
        .join(' · ')
    : null;

  const handleAdd = () => {
    if (variants.length > 0 && !activeVariant) return;
    tapHaptic();
    setAddedFlash(true);
    addToCart({
      ...product,
      qty,
      // Override line-item details from the variant when one is selected.
      price:      displayPrice,
      image_url:  displayImageOverride ?? product.image_url,
      variant_id: activeVariant?.id ?? null,
      variant_label: variantLabel,
    });
    setTimeout(() => setAddedFlash(false), 400);
  };

  // Untracked products (inventory managed externally) are always sellable,   // their stock count is meaningless, so a 0 must not disable the buy button.
  const outOfStock = product.track_inventory !== false && displayStock === 0;
  const ctaDisabled = outOfStock || (variants.length > 0 && !activeVariant);
  // True when the only thing blocking the add is an unmade variant choice.
  const needsSelection = !outOfStock && variants.length > 0 && !allAttrsSelected;

  // Sticky-bar CTA. The bar has no variant picker of its own, so when a choice
  // is still required, tapping it must take the shopper *back to the picker*
  // (which lives in the in-page buy panel) instead of being a disabled
  // dead-end, the previous behaviour left mobile users tapping a greyed
  // "Select options" button with no on-screen way to act.
  const handleStickyCta = () => {
    if (needsSelection) {
      // Scroll to the picker itself (not the buy row below it) and flash it.
      (variantPickerRef.current ?? buyPanelRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashPicker(true);
      setTimeout(() => setFlashPicker(false), 1400);
      return;
    }
    handleAdd();
  };

  // WP imports often include the brand inside the name (e.g. brand="Kiko Milano",
  // name="Kiko Milano 3D Hydra Lip Gloss"). Strip the brand prefix for the visible
  // h1 + breadcrumb crumb so we don't render "KIKO MILANO" twice in a row.
  const displayName = stripBrandPrefix(product.brand, product.name);

  // The visible breadcrumb trail + its BreadcrumbList schema are rendered once,
  // by the product route (app/product/[slug]/page.tsx) above this component.
  // PDPPage must NOT render its own trail too, or the page shows two crumbs.
  return (
    <div>
      <div className="container" style={{ borderTop: '1px solid var(--line)' }}>
        {/* minmax(0,1fr) lets each column shrink below its content's intrinsic
            width, without it a long product name forced the grid wider than
            the viewport. maxWidth caps the image column so the gallery isn't
            a ~700px monster on a wide desktop. */}
        {/* alignItems:start so the gallery cell sizes to the image and does
            NOT stretch to the row height, otherwise opening an accordion in
            the right column grows the row and the aspect-ratio image scales
            up/down with it. */}
        {/* Image column capped (~400px) so the gallery slider stays a sensible
            size on wide desktops instead of ballooning; the details column takes
            the remaining width. Collapses to 1-col ≤900px (.pdp-grid in
            globals.css). */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 400px) minmax(0, 1fr)', gap: 48, padding: '40px 0', maxWidth: 1080, margin: '0 auto', alignItems: 'start' }} className="pdp-grid">
          {/* Keyed on the picked variant's image so choosing a shade/size
              remounts the gallery with that variant's photo as the active hero
              (see Gallery: the variant→gallery link). Non-variable products key
              on 'base' and never remount. */}
          <Gallery key={displayImageOverride ?? 'base'} images={galleryToShow} alt={`${product.brand ?? ''} ${displayName}`.trim()} fallback={product.image_url} brandLabel={product.brand ?? undefined} videoUrl={product.video_url} />

          <div style={{ minWidth: 0 }}>
            {product.brand && (
              <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>
                {/* Link the brand to its archive page, a descriptive internal
                    link from every PDP to /brand/<slug>, which strengthens the
                    brand pages (previously linked only from /brands). */}
                <a href={brandHref(product.brand)} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {product.brand}
                </a>
              </Overline>
            )}
            {/* Fluid title: fixed 2.5rem wrapped to ~5 lines on a 390px phone
                and pushed the buy box below the fold. The clamp keeps desktop
                essentially unchanged while phones get ~26px. */}
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 6vw, 2.5rem)', fontWeight: 500,
              letterSpacing: '-0.025em', lineHeight: 1.15, marginBottom: 8,
              overflowWrap: 'break-word',
            }}>{displayName}</h1>
            {product.review_count != null && product.review_count > 0 && (
              <a
                href="#reviews"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12, textDecoration: 'none' }}
                aria-label={`${product.review_count} customer review${product.review_count === 1 ? '' : 's'}, read reviews`}
              >
                <StarRating rating={product.rating} count={product.review_count} size={15} />
                <span className="small-text" style={{ color: 'var(--brand-pink-text)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  See all {product.review_count} review{product.review_count === 1 ? '' : 's'} ↓
                </span>
              </a>
            )}
            {product.variant && variants.length === 0 && (
              <div className="body-text" style={{ color: 'var(--ink-500)', marginBottom: 16 }}>{product.variant}</div>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
              <span className="tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 600 }}>PKR {displayPrice.toLocaleString()}</span>
              {(displayOriginal ?? 0) > displayPrice && (
                <span className="tabular-nums" style={{ textDecoration: 'line-through', color: 'var(--brand-pink-text)', fontSize: '1rem' }}>
                  PKR {(displayOriginal ?? 0).toLocaleString()}
                </span>
              )}
            </div>
            {pointsEarned > 0 && (
              <p className="small-text" style={{ marginTop: -8, marginBottom: 16, color: 'var(--brand-pink-text)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span aria-hidden="true">★</span>
                Earn <strong style={{ fontWeight: 600 }}>{pointsEarned.toLocaleString()}</strong> reward {pointsEarned === 1 ? 'point' : 'points'} with this order
              </p>
            )}
            <div style={{ marginBottom: 20 }}>
              {outOfStock ? (
                <span style={{ display: 'inline-block', padding: '3px 10px', background: '#fef2f2', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, color: '#dc2626' }}>Out of Stock</span>
              ) : product.track_inventory !== false && displayStock <= 5 ? (
                <span style={{ display: 'inline-block', padding: '3px 10px', background: '#fffbeb', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, color: '#d97706' }}>Only {displayStock} left</span>
              ) : (
                <span style={{ display: 'inline-block', padding: '3px 10px', background: '#f0fdf4', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, color: '#15803d' }}>In Stock</span>
              )}
            </div>
            {/* Packaging disclosure — genuine items sold as a tester or without
                their retail box. Placed in the buy box so the condition is
                impossible to miss before adding to cart; copy leads on
                authenticity because that's the shopper's first question. */}
            {product.packaging && product.packaging !== 'standard' && (
              <div style={{
                marginBottom: 20, padding: '12px 14px', borderRadius: 10,
                background: '#fffbeb', border: '1px solid #fde68a',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span aria-hidden="true" style={{ fontSize: '1rem', lineHeight: 1.3 }}>📦</span>
                <p className="small-text" style={{ margin: 0, color: '#92400e', lineHeight: 1.5 }}>
                  {product.packaging === 'tester' ? (
                    <>
                      <strong style={{ fontWeight: 700 }}>Tester unit.</strong> This is a 100% genuine manufacturer&rsquo;s
                      tester — the same product inside, at a lower price. It may arrive without the full retail
                      box or cap.
                    </>
                  ) : (
                    <>
                      <strong style={{ fontWeight: 700 }}>Sold without box.</strong> This is a 100% original,
                      unused product supplied without its retail box — same item, lower price.
                    </>
                  )}
                </p>
              </div>
            )}
            <hr className="hairline" style={{ marginBottom: 24 }} />

            {attributes.length > 0 && (
              <div
                ref={variantPickerRef}
                className={flashPicker ? 'pdp-picker-flash' : undefined}
                style={{ scrollMarginTop: 80, borderRadius: 12, transition: 'box-shadow 200ms, background 200ms', marginBottom: 4 }}
              >
                <VariantPicker
                  attributes={attributes}
                  variants={variants}
                  selected={selected}
                  onChange={setSelected}
                />
              </div>
            )}

            <div ref={buyPanelRef} style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)' }}>
                <button type="button" aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 40, height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--ink-700)' }}>−</button>
                <span aria-live="polite" style={{ width: 32, textAlign: 'center', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{qty}</span>
                <button type="button" aria-label="Increase quantity" onClick={() => setQty(qty + 1)} style={{ width: 40, height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--ink-700)' }}>+</button>
              </div>
              <button onClick={handleAdd} disabled={ctaDisabled || addedFlash} className="btn-primary" style={{
                flex: 1,
                background: ctaDisabled ? '#d1d5db' : addedFlash ? 'var(--brand-yellow)' : 'var(--brand-pink-cta)',
                transition: 'background 100ms ease-out',
                cursor: ctaDisabled ? 'not-allowed' : 'pointer',
              }}>
                {outOfStock ? 'Out of Stock'
                  : variants.length > 0 && !allAttrsSelected ? 'Select options'
                  : addedFlash ? 'Added ✓'
                  : 'Add to Cart'}
              </button>
            </div>

            {!outOfStock && estimatedDays && (
              <p className="small-text" style={{ marginTop: -8, marginBottom: 24, color: 'var(--ink-700)' }}>
                Delivery in <strong style={{ fontWeight: 600 }}>{estimatedDays.min} to {estimatedDays.max} working days</strong> · COD nationwide
              </p>
            )}

            {/* Always-on trust strip: answers "genuine? / pay on delivery? /
                returnable?" at the add-to-cart moment. Matters most on the ~95%
                of products that have no reviews yet (cold-traffic confidence). */}
            <TrustStrip />

            {/* WhatsApp CTA, pre-fills the merchant chat with this product's
                name so any "do you have shade X?" / "is this authentic?"
                question lands with full context. Hides if the env var
                isn't set. */}
            {(() => {
              // Gate on a configured number; route through /go/whatsapp (crawler-
              // safe + logs the click with this product's context).
              if (!waUrl(WA_T.product(product.name))) return null;
              const href = whatsappGoUrl(WA_T.product(product.name), { src: 'pdp', productSlug: product.slug });
              return (
                <div style={{ marginBottom: 24 }}>
                  <a
                    href={href}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: 'transparent', color: '#0f766e',
                      textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
                      border: '1px solid #25D366', borderRadius: 999,
                      padding: '8px 16px',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Ask about this on WhatsApp
                  </a>
                </div>
              );
            })()}

            {/* Migration 081, key benefits bar (admin-curated). High-leverage
                content block: scannable in 2 seconds, keyword-rich, and the
                emoji icons are pure design without hitting the bundle. */}
            {Array.isArray(product.key_benefits) && product.key_benefits.length > 0 && (
              <ul style={{
                listStyle: 'none', padding: 0, margin: '0 0 24px',
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10,
              }}>
                {product.key_benefits.map((b, i) => (
                  <li key={i} style={{
                    padding: '10px 14px', background: 'var(--paper2, #faf6ee)', borderRadius: 8,
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: '0.8125rem', color: 'var(--ink-700)', lineHeight: 1.4,
                  }}>
                    {b.icon && (
                      <span aria-hidden="true" style={{
                        flex: '0 0 auto', display: 'inline-flex', alignItems: 'center',
                        color: 'var(--brand-pink-text, #C5286A)',
                      }}>
                        <BenefitIcon name={b.icon} size={18} />
                      </span>
                    )}
                    <span>{b.text}</span>
                  </li>
                ))}
              </ul>
            )}

            {product.description && <ProductDescription text={product.description} maxWidth={440} />}

            {/* Supplement-specific assurance + consult panel. NB Sons (our
                house wellness brand) is unfamiliar to cold visitors and carries
                no reviews yet, so the view→cart step stalls on trust. These are
                concrete, truthful commitments (sealed, stored right, dated) plus
                a consult CTA that opens the assisted, WhatsApp path supplement
                buyers historically converted through. Wellness only. */}
            {isWellness && (() => {
              const consultHref = waUrl(WA_T.consult(product.name))
                ? whatsappGoUrl(WA_T.consult(product.name), { src: 'pdp-consult', productSlug: product.slug })
                : null;
              const assurances: { icon: 'shield' | 'thermometer' | 'calendar'; text: string }[] = [
                { icon: 'shield', text: '100% genuine, sealed as packed by the manufacturer' },
                { icon: 'thermometer', text: 'Stored cool and dry, exactly as a supplement should be' },
                { icon: 'calendar', text: 'Fresh stock with clear, valid expiry dates' },
              ];
              return (
                <div style={{
                  maxWidth: 440, margin: '0 0 24px', padding: '16px 18px',
                  background: 'var(--paper2, #faf6ee)', border: '1px solid var(--line)',
                  borderRadius: 10,
                }}>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {assurances.map((a, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.8125rem', color: 'var(--ink-700)', lineHeight: 1.45 }}>
                        <span aria-hidden="true" style={{ flex: '0 0 auto', color: 'var(--brand-pink-text, #C5286A)', marginTop: 1 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            {a.icon === 'shield' && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
                            {a.icon === 'thermometer' && <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />}
                            {a.icon === 'calendar' && <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>}
                          </svg>
                        </span>
                        <span>{a.text}</span>
                      </li>
                    ))}
                  </ul>
                  {consultHref && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                      <p className="small-text" style={{ margin: '0 0 10px', color: 'var(--ink-700)', lineHeight: 1.45 }}>
                        Not sure if this is right for you? Ask our team before you order, no pressure.
                      </p>
                      <a
                        href={consultHref}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          background: '#25D366', color: '#fff',
                          textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
                          borderRadius: 999, padding: '9px 18px',
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        Ask before you buy
                      </a>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* YMYL safeguard: supplements carry a "food supplement, not a
                medicine" disclaimer. Cosmetics/makeup don't. */}
            {isWellness && (
              <div style={{ maxWidth: 440 }}>
                <MedicalDisclaimer variant="product" />
              </div>
            )}

            {/* Migration 081, short testimonial / press quote, rendered as a
                paper2 callout so it reads as social signal rather than body
                copy. */}
            {product.social_proof && (
              <blockquote style={{
                margin: '0 0 24px', padding: '14px 18px',
                background: 'var(--paper2, #faf6ee)', borderLeft: '3px solid var(--brand-pink, #C5286A)',
                borderRadius: 6,
                fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--ink-700)', lineHeight: 1.5,
              }}>
                {product.social_proof}
              </blockquote>
            )}

            <hr className="hairline" style={{ marginBottom: 0 }} />
            {([
              product.how_to_use ? { key: 'use', title: 'How to Use', content: product.how_to_use } : null,
              product.ingredients ? { key: 'ingredients', title: 'Ingredients', content: product.ingredients } : null,
              product.usage_tips ? { key: 'tips', title: 'Usage Tips', content: product.usage_tips } : null,
              { key: 'shipping', title: 'Shipping & Returns', content: shippingContent },
            ] as Array<{ key: string; title: string; content: string } | null>)
              .filter(Boolean)
              .map(sec => sec && (
              // Native <details> so the body ships in the server HTML — the
              // ingredients/INCI list and directions are exactly the keyword-rich
              // copy search needs, and were previously mounted only on click
              // (invisible to crawlers). The title is a real <h2> inside the
              // summary, giving the PDP a proper heading outline. Open by default
              // on desktop via CSS; collapsible without JS.
              <details key={sec.key} className="pdp-accordion" style={{ borderBottom: '1px solid var(--line)' }}>
                <summary style={{
                  width: '100%', padding: '16px 0', cursor: 'pointer', listStyle: 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-900)' }}>{sec.title}</h2>
                  <span aria-hidden="true" className="pdp-accordion-chevron" style={{ fontSize: '0.75rem', color: 'var(--ink-500, #6b7280)' }}>▼</span>
                </summary>
                <div className="body-text" style={{ color: 'var(--ink-700)', paddingBottom: 16, whiteSpace: 'pre-wrap' }}>{sec.content}</div>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* NOTE: the full-width "Why this product earns a spot in your routine"
          band used to render here, but it repeated the exact four claims the
          buy-box TrustStrip already makes (authentic / COD / returns /
          delivery). Removed to kill the triplication; the buy-box chips are
          the single source of those trust signals on the PDP. */}

      {/* Migration 081, FAQ section. Renders below the gallery split so the
          accordion is the first thing the visitor sees after deciding to
          scroll past the buy-bar. FAQPage schema is emitted by the route
          (see app/product/[slug]/page.tsx) so the rich-result is paired
          with visible content. */}
      {(() => {
        // Show the admin-authored FAQ when present, else the store-fact
        // fallback, so every product page has a FAQ block (and matching
        // FAQPage schema emitted by the route).
        const faqItems = effectiveProductFaq(product.faq, { estimatedDays });
        return (
        <section style={{ padding: '48px 0', borderTop: '1px solid var(--line)' }}>
          {/* Use the standard page container so the FAQ's left edge lines up
              with the product content above and the related-products section
              below; cap the text at a readable width but left-align it (no auto
              margins) instead of floating it in a narrow centred column. */}
          <div className="container">
            <div style={{ maxWidth: 760 }}>
            <Overline style={{ display: 'block', marginBottom: 16 }}>Frequently asked</Overline>
            <h2 className="display-l" style={{ fontSize: '1.75rem', marginBottom: 24 }}>Questions about this product</h2>
            <div style={{ borderTop: '1px solid var(--line)' }}>
              {faqItems.map((f, i) => (
                <details key={i} style={{ borderBottom: '1px solid var(--line)', padding: '14px 0' }}>
                  <summary style={{
                    cursor: 'pointer', listStyle: 'none',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16,
                    fontFamily: 'var(--font-ui)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink-900)',
                  }}>
                    <span>{f.q}</span>
                    <span aria-hidden="true" style={{ flex: '0 0 auto', fontSize: '0.75rem', color: 'var(--ink-500, #6b7280)' }}>▼</span>
                  </summary>
                  <div className="body-text" style={{ marginTop: 10, color: 'var(--ink-700)', whiteSpace: 'pre-wrap' }}>
                    {f.a}
                  </div>
                </details>
              ))}
            </div>
            </div>
          </div>
        </section>
        );
      })()}

      {relatedProducts.length > 0 && (
        <section style={{ padding: '64px 0' }}>
          <div className="container">
            <Overline as="h2" style={{ display: 'block', marginBottom: 32 }}>Pairs With</Overline>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }} className="product-grid">
              {relatedProducts.map((p) => (
                <ProductTile key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Sticky mobile buy-bar, fixed to the bottom of the viewport once the
          in-page buy panel scrolls off the top. Mobile-only via the
          `pdp-sticky-bar` CSS class (display:none ≥768px). Reuses the same
          qty + handleAdd as the in-page panel so state stays in sync. */}
      <div
        ref={stickyBarRef}
        className="pdp-sticky-bar"
        inert={!showStickyBar}
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
          transform: showStickyBar ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          pointerEvents: showStickyBar ? 'auto' : 'none',
        }}
      >
        {/* Title block takes the flexible space (flex:1 + minWidth:0 so the
            ellipsis works); the CTA below is flexShrink:0 so a long product
            name can never crush it into a sliver of wrapped text. Price
            renders exactly once, here. */}
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <div style={{
            fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-900)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{displayName}</div>
          <div className="tabular-nums" style={{ fontSize: '0.875rem', fontWeight: 700 }}>
            PKR {displayPrice.toLocaleString()}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', flexShrink: 0 }}>
          <button type="button" aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 34, height: 40, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--ink-700)' }}>−</button>
          <span aria-live="polite" style={{ width: 26, textAlign: 'center', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{qty}</span>
          <button type="button" aria-label="Increase quantity" onClick={() => setQty(qty + 1)} style={{ width: 34, height: 40, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--ink-700)' }}>+</button>
        </div>
        <button
          onClick={handleStickyCta}
          // Only a genuine out-of-stock disables the bar. When a variant choice
          // is still needed the button stays tappable and scrolls to the picker.
          disabled={outOfStock}
          className="btn-primary"
          style={{
            flexShrink: 0, whiteSpace: 'nowrap', minHeight: 48, padding: '12px 18px',
            background: outOfStock ? '#d1d5db' : addedFlash ? 'var(--brand-yellow)' : 'var(--brand-pink-cta)',
            cursor: outOfStock ? 'not-allowed' : 'pointer',
            transition: 'background 100ms ease-out',
          }}
        >
          {outOfStock ? 'Out of Stock'
            : needsSelection ? 'Select options'
            : addedFlash ? 'Added ✓'
            : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}
