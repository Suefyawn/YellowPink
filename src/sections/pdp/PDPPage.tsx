'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import { ProductTile } from '@/components/ui/ProductTile';
import { useCart } from '@/context/CartContext';
import type { Product, ProductImage as ProductImageT, ProductAttribute, AttributeValue, ProductVariant } from '@/types';

const SHIPPING_CONTENT = 'Free shipping on orders over PKR 2,500. COD available nationwide. 7-day return policy on unopened items.';

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
      Object.entries(test).every(([_a, vId]) => v.option_value_ids.includes(vId))
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
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-900)' }}>{attr.name}</span>
              {selectedLabel && <span style={{ fontSize: '0.8125rem', color: 'var(--ink-500)' }}>{selectedLabel}</span>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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

// ─── Multi-image gallery ───────────────────────────────────────────────────
function Gallery({
  images, alt, fallback,
}: {
  images: ProductImageT[];
  alt: string;
  fallback?: string | null;
}) {
  const hero = images[0]?.url ?? fallback ?? null;
  const [active, setActive] = useState<string | null>(hero);

  if (images.length <= 1) {
    return (
      <div style={{ flex: 1, aspectRatio: '4/5', borderRadius: 'var(--radius-card)', overflow: 'hidden', background: 'var(--paper2)' }}>
        <ProductImage src={active ?? fallback} alt={alt} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 12, flex: 1 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 64, flexShrink: 0 }}>
        {images.map(img => (
          <button
            key={img.id}
            type="button"
            onClick={() => setActive(img.url)}
            aria-label={img.alt ?? alt}
            style={{
              width: 64, height: 80, padding: 0,
              border: '1px solid ' + (active === img.url ? 'var(--ink-900)' : 'var(--line)'),
              borderRadius: 'var(--radius-card)', overflow: 'hidden',
              background: 'var(--paper2)', cursor: 'pointer',
            }}
          >
            <ProductImage src={img.url} alt={img.alt ?? alt} />
          </button>
        ))}
      </div>
      <div style={{ flex: 1, aspectRatio: '4/5', borderRadius: 'var(--radius-card)', overflow: 'hidden', background: 'var(--paper2)' }}>
        <ProductImage src={active} alt={alt} />
      </div>
    </div>
  );
}

// ─── PDPPage ───────────────────────────────────────────────────────────────
export function PDPPage({ product, relatedProducts = [], variants = [], attributes = [], gallery = [] }: Props) {
  const [qty, setQty] = useState(1);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [addedFlash, setAddedFlash] = useState(false);
  const { addToCart } = useCart();

  // Default-select the first reachable value for every attribute (or none).
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

  const outOfStock = displayStock === 0;
  const ctaDisabled = outOfStock || (variants.length > 0 && !activeVariant);

  return (
    <div>
      <div className="container" style={{ padding: '16px var(--side)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', color: 'var(--ink-500)', textDecoration: 'none' }}>Home</Link>
          <span style={{ color: 'var(--ink-500)', fontSize: '0.75rem' }}>/</span>
          <Link href="/shop" style={{ fontSize: '0.8125rem', color: 'var(--ink-500)', textDecoration: 'none' }}>{product.brand}</Link>
          <span style={{ color: 'var(--ink-500)', fontSize: '0.75rem' }}>/</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--ink-900)' }}>{product.name}</span>
        </div>
      </div>

      <div className="container" style={{ borderTop: '1px solid var(--line)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, padding: '40px 0' }} className="pdp-grid">
          <Gallery images={galleryToShow} alt={`${product.brand} ${product.name}`} fallback={product.image_url} />

          <div>
            <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>{product.brand}</Overline>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 500,
              letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: 8,
            }}>{product.name}</h1>
            {product.variant && variants.length === 0 && (
              <div className="body-text" style={{ color: 'var(--ink-500)', marginBottom: 16 }}>{product.variant}</div>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
              <span className="tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 600 }}>PKR {displayPrice.toLocaleString()}</span>
              {displayOriginal && displayOriginal > displayPrice && (
                <span className="tabular-nums" style={{ textDecoration: 'line-through', color: 'var(--brand-pink)', fontSize: '1rem' }}>
                  PKR {displayOriginal.toLocaleString()}
                </span>
              )}
            </div>
            <div style={{ marginBottom: 20 }}>
              {outOfStock ? (
                <span style={{ display: 'inline-block', padding: '3px 10px', background: '#fef2f2', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, color: '#dc2626' }}>Out of Stock</span>
              ) : displayStock <= 5 ? (
                <span style={{ display: 'inline-block', padding: '3px 10px', background: '#fffbeb', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, color: '#d97706' }}>Only {displayStock} left</span>
              ) : (
                <span style={{ display: 'inline-block', padding: '3px 10px', background: '#f0fdf4', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, color: '#16a34a' }}>In Stock</span>
              )}
            </div>
            <hr className="hairline" style={{ marginBottom: 24 }} />

            {attributes.length > 0 && (
              <VariantPicker
                attributes={attributes}
                variants={variants}
                selected={selected}
                onChange={setSelected}
              />
            )}

            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)' }}>
                <button onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 40, height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--ink-700)' }}>−</button>
                <span style={{ width: 32, textAlign: 'center', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{qty}</span>
                <button onClick={() => setQty(qty + 1)} style={{ width: 40, height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--ink-700)' }}>+</button>
              </div>
              <button onClick={handleAdd} disabled={ctaDisabled} className="btn-primary" style={{
                flex: 1,
                background: ctaDisabled ? '#d1d5db' : addedFlash ? 'var(--brand-yellow)' : 'var(--brand-pink)',
                transition: 'background 100ms ease-out',
                cursor: ctaDisabled ? 'not-allowed' : 'pointer',
              }}>
                {outOfStock ? 'Out of Stock'
                  : variants.length > 0 && !allAttrsSelected ? 'Select options'
                  : addedFlash ? 'Added ✓'
                  : 'Add to Cart'}
              </button>
            </div>

            {product.description && (
              <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 24, maxWidth: 440 }}>
                {product.description}
              </p>
            )}
            <hr className="hairline" style={{ marginBottom: 0 }} />
            {([
              product.how_to_use ? { key: 'use', title: 'How to Use', content: product.how_to_use } : null,
              product.ingredients ? { key: 'ingredients', title: 'Ingredients', content: product.ingredients } : null,
              { key: 'shipping', title: 'Shipping & Returns', content: SHIPPING_CONTENT },
            ] as Array<{ key: string; title: string; content: string } | null>)
              .filter(Boolean)
              .map(sec => sec && (
              <div key={sec.key} style={{ borderBottom: '1px solid var(--line)' }}>
                <button onClick={() => setExpandedSection(expandedSection === sec.key ? null : sec.key)} style={{
                  width: '100%', padding: '16px 0', background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontFamily: 'var(--font-ui)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-900)',
                }}>
                  {sec.title}
                  <span style={{ transform: expandedSection === sec.key ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms ease-out', fontSize: '0.75rem' }}>▼</span>
                </button>
                {expandedSection === sec.key && (
                  <div className="body-text" style={{ color: 'var(--ink-700)', paddingBottom: 16 }}>{sec.content}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <section style={{ background: 'var(--paper2)', padding: 'var(--section-gap) 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container story-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          <div className="img-placeholder" style={{ aspectRatio: '4/3', borderRadius: 'var(--radius-card)' }}>
            <span>editorial lifestyle photo</span>
          </div>
          <div>
            <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>The Story</Overline>
            <h2 className="display-l" style={{ fontSize: '2rem', marginBottom: 16 }}>Why {product.name}?</h2>
            <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 16, maxWidth: 440 }}>
              Every product we carry has been tested, reviewed, and chosen for Pakistani skin tones and climates. We don&apos;t carry what doesn&apos;t work.
            </p>
            <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 440 }}>
              Imported directly from authorized distributors. No fakes, no compromises.
            </p>
          </div>
        </div>
      </section>

      {relatedProducts.length > 0 && (
        <section style={{ padding: 'var(--section-gap) 0' }}>
          <div className="container">
            <Overline style={{ display: 'block', marginBottom: 32 }}>Pairs With</Overline>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }} className="product-grid">
              {relatedProducts.map((p) => (
                <Link key={p.id} href={`/product/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <ProductTile product={p} />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
