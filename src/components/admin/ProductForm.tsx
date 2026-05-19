'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { createProduct, updateProduct } from '@/app/admin/actions';
import { ImageUpload } from './ImageUpload';
import type { Product } from '@/types';

const SUBCATEGORIES: Record<string, string[]> = {
  Makeup: ['Lip & Cheek Tints', 'Highlighters', 'Skin Makeup', 'Concealers', 'Contour Sticks', 'Foundations', 'Eyeshadow', 'Brushes', 'Budget Bundles'],
  Skincare: ['Skincare', 'Moisturizers', 'Hair Care', 'Sunscreens'],
  Wellness: ['Health & Wellness', 'Human Health', 'Bone Health', 'Brain Health', 'Immune Support', 'Female Fertility & Reproductive Health', 'Digestive Health & Weight Management', 'Heart & Cardiovascular', 'Energy & Performance', 'Combo Packs', 'Pediatric Health', 'Sleep & Relaxation', 'Electrolyte Balance', 'Immunity & Wellness'],
};

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.875rem', color: '#111827',
  background: 'white', outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem',
  fontWeight: 600, color: '#374151', marginBottom: 5,
};
const fieldWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column' };
const hint: React.CSSProperties = { marginTop: 4, fontSize: '0.6875rem', color: '#6b7280' };

export function ProductForm({ product }: { product?: Product }) {
  const isEdit = Boolean(product);
  const boundAction = isEdit ? updateProduct.bind(null, product!.id) : createProduct;
  const [state, action, pending] = useActionState(boundAction, null);

  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [category, setCategory] = useState(product?.category ?? '');

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Link href="/admin/products" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>
          ← Products
        </Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
          {isEdit ? 'Edit Product' : 'New Product'}
        </h1>
      </div>

      <div style={{ background: 'white', borderRadius: 10, padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', maxWidth: 760 }}>
        {state?.error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '10px 14px', marginBottom: 20, color: '#dc2626', fontSize: '0.875rem' }}>
            {state.error}
          </div>
        )}

        <form action={action}>
          {/* Row 1 */}
          <div className="adm-form-brand" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 16 }}>
            <div style={fieldWrap}>
              <label style={lbl}>Brand</label>
              <input name="brand" defaultValue={product?.brand ?? ''} style={inp} placeholder="e.g. CeraVe (leave blank for own-label products)" />
            </div>
            <div style={fieldWrap}>
              <label style={lbl}>Product Name *</label>
              <input
                name="name" required
                value={name}
                onChange={e => { setName(e.target.value); if (!isEdit) setSlug(toSlug(e.target.value)); }}
                style={inp} placeholder="e.g. Moisturizing Cream"
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="adm-form-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={fieldWrap}>
              <label style={lbl}>Variant</label>
              <input name="variant" defaultValue={product?.variant ?? ''} style={inp} placeholder="e.g. 250ml" />
            </div>
            <div style={fieldWrap}>
              <label style={lbl}>Price (PKR) *</label>
              <input name="price" type="number" required min={0} defaultValue={product?.price} style={inp} placeholder="2400" />
            </div>
            <div style={fieldWrap}>
              <label style={lbl}>Original Price (PKR)</label>
              <input name="original_price" type="number" min={0} defaultValue={product?.original_price ?? ''} style={inp} placeholder="3000" />
            </div>
          </div>

          {/* Row 2.5 — product kind */}
          <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 16 }}>
            <div style={fieldWrap}>
              <label style={lbl}>Type</label>
              <select name="kind" defaultValue={product?.kind ?? 'simple'} style={inp}>
                <option value="simple">Simple (single SKU)</option>
                <option value="variable">Variable (with variants)</option>
                <option value="bundle">Bundle / grouped</option>
                <option value="external">External</option>
              </select>
              <span style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: 4 }}>
                Variable products manage stock per variant below.
              </span>
            </div>
          </div>

          {/* Row 3 */}
          <div className="adm-form-4col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={fieldWrap}>
              <label style={lbl}>Category *</label>
              <select name="category" required value={category} onChange={e => setCategory(e.target.value)} style={inp}>
                <option value="">— Select —</option>
                <option value="Makeup">Makeup</option>
                <option value="Skincare">Skincare</option>
                <option value="Wellness">Wellness</option>
              </select>
            </div>
            <div style={fieldWrap}>
              <label style={lbl}>Subcategory</label>
              <select name="subcategory" defaultValue={product?.subcategory ?? ''} style={inp}>
                <option value="">— None —</option>
                {(SUBCATEGORIES[category] ?? []).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div style={fieldWrap}>
              <label style={lbl}>Tag</label>
              <select name="tag" defaultValue={product?.tag ?? ''} style={inp}>
                <option value="">— None —</option>
                <option value="New">New</option>
                <option value="Sale">Sale</option>
                <option value="Bestseller">Bestseller</option>
                <option value="Featured">Featured</option>
                <option value="Limited">Limited</option>
              </select>
            </div>
            <div style={fieldWrap}>
              <label style={lbl}>Stock Quantity *</label>
              <input name="stock" type="number" required min={0} defaultValue={product?.stock ?? 0} style={inp} placeholder="0" />
            </div>
          </div>

          {/* Slug */}
          <div style={{ ...fieldWrap, marginBottom: 16 }}>
            <label style={lbl}>URL Slug *</label>
            <input
              name="slug" required
              value={slug}
              onChange={e => setSlug(e.target.value)}
              style={{ ...inp, fontFamily: 'monospace', fontSize: '0.8125rem' }}
              placeholder="product-url-slug"
            />
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4 }}>
              /product/{slug || 'product-slug'}
            </span>
          </div>

          {/* Image Upload */}
          <div style={{ ...fieldWrap, marginBottom: 16 }}>
            <ImageUpload name="image_url" currentUrl={product?.image_url} label="Product Image" aspect={1} />
          </div>

          {/* Content fields */}
          <div style={{ ...fieldWrap, marginBottom: 16 }}>
            <label style={lbl}>Description</label>
            <textarea name="description" defaultValue={product?.description ?? ''} rows={3}
              style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Short product description shown on the product page…" />
          </div>
          <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            <div style={fieldWrap}>
              <label style={lbl}>How to Use</label>
              <textarea name="how_to_use" defaultValue={product?.how_to_use ?? ''} rows={4}
                style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="Application instructions…" />
            </div>
            <div style={fieldWrap}>
              <label style={lbl}>Ingredients</label>
              <textarea name="ingredients" defaultValue={product?.ingredients ?? ''} rows={4}
                style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="Aqua, Glycerin, Niacinamide…" />
            </div>

            {/* ── Migration 081: PDP content + SEO fields ─────────────────── */}
            <div style={{ marginTop: 12, paddingTop: 18, borderTop: '1px dashed #e5e7eb' }}>
              <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 700, color: '#111827' }}>Content & SEO</h2>
              <p style={{ margin: '0 0 14px', fontSize: '0.75rem', color: '#6b7280' }}>
                Everything below is optional. Leave blank to fall back to auto-generated values.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={lbl}>SEO title</label>
                <input
                  name="seo_title"
                  type="text"
                  defaultValue={product?.seo_title ?? ''}
                  maxLength={120}
                  placeholder='e.g. "CeraVe Hydrating Cleanser — Buy in Pakistan (COD)"'
                  style={inp}
                />
                <div style={hint}>Auto-default: brand + name. ≤60 chars ideal.</div>
              </div>
              <div>
                <label style={lbl}>OG image URL</label>
                <input
                  name="og_image_url"
                  type="url"
                  defaultValue={product?.og_image_url ?? ''}
                  maxLength={500}
                  placeholder="https://… (defaults to the product image)"
                  style={inp}
                />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={lbl}>SEO description</label>
              <textarea
                name="seo_description"
                defaultValue={product?.seo_description ?? ''}
                rows={2}
                maxLength={220}
                placeholder="One-paragraph pitch with the keyword + COD/Pakistan signal."
                style={{ ...inp, fontFamily: 'inherit' }}
              />
              <div style={hint}>Auto-default: short_description / description / generic. ≤160 chars ideal.</div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={lbl}>Key benefits</label>
              <textarea
                name="key_benefits"
                defaultValue={product?.key_benefits ? JSON.stringify(product.key_benefits, null, 2) : ''}
                rows={5}
                placeholder={`JSON array of {icon?, text}. icon names: shield, leaf, sparkle, droplet, pulse, flower, bottle, heart, bolt, sun, moon, dna, flame.\n[\n  {"icon":"sparkle","text":"Brightens in 7 days"},\n  {"icon":"droplet","text":"Hyaluronic acid + ceramides"}\n]`}
                style={{ ...inp, fontFamily: 'monospace', fontSize: '0.75rem' }}
              />
              <div style={hint}>Rendered as the benefit bar at the top of the PDP. JSON array.</div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={lbl}>FAQ</label>
              <textarea
                name="faq"
                defaultValue={product?.faq ? JSON.stringify(product.faq, null, 2) : ''}
                rows={7}
                placeholder={`JSON array of {q, a}. e.g.\n[\n  {"q":"Is it suitable for oily skin?","a":"Yes — non-comedogenic."},\n  {"q":"How long does delivery take?","a":"2-4 working days nationwide."}\n]`}
                style={{ ...inp, fontFamily: 'monospace', fontSize: '0.75rem' }}
              />
              <div style={hint}>Powers the FAQ section on the PDP + the FAQPage schema for rich-result eligibility.</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
              <div>
                <label style={lbl}>Usage tips</label>
                <textarea
                  name="usage_tips"
                  defaultValue={product?.usage_tips ?? ''}
                  rows={4}
                  placeholder="Care tips, layering advice, or seasonal notes."
                  style={{ ...inp, fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <label style={lbl}>Social proof</label>
                <textarea
                  name="social_proof"
                  defaultValue={product?.social_proof ?? ''}
                  rows={4}
                  maxLength={500}
                  placeholder='e.g. "Featured in Vogue Pakistan, July 2025."'
                  style={{ ...inp, fontFamily: 'inherit' }}
                />
              </div>
            </div>
          </div>

          {/* Sticky save bar — pins to the bottom of the viewport while the
              admin scrolls long product edits. Falls back to flow on short
              forms so it doesn't float in negative space. */}
          <div
            style={{
              position: 'sticky', bottom: 0,
              marginTop: 20,
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.94)',
              backdropFilter: 'saturate(140%) blur(8px)',
              WebkitBackdropFilter: 'saturate(140%) blur(8px)',
              borderTop: '1px solid #e5e7eb',
              borderRadius: '0 0 10px 10px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, flexWrap: 'wrap',
              boxShadow: '0 -6px 18px rgba(0,0,0,0.04)',
              zIndex: 5,
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {pending
                ? 'Saving…'
                : isEdit
                  ? <>Editing <strong style={{ color: '#111827' }}>{product?.name ?? 'product'}</strong></>
                  : 'Creating a new product'}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Link href="/admin/products" style={{
                padding: '9px 18px', background: 'white', color: '#374151',
                border: '1px solid #d1d5db', borderRadius: 7,
                fontSize: '0.8125rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
              }}>
                Cancel
              </Link>
              <button type="submit" disabled={pending} style={{
                padding: '10px 24px', background: pending ? '#9ca3af' : '#C5286A',
                color: 'white', border: 'none', borderRadius: 7,
                fontSize: '0.8125rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer',
              }}>
                {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
