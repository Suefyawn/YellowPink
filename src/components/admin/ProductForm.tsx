'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { createProduct, updateProduct } from '@/app/admin/actions';
import type { Product } from '@/types';

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

export function ProductForm({ product }: { product?: Product }) {
  const isEdit = Boolean(product);
  const boundAction = isEdit ? updateProduct.bind(null, product!.id) : createProduct;
  const [state, action, pending] = useActionState(boundAction, null);

  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '');

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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 16 }}>
            <div style={fieldWrap}>
              <label style={lbl}>Brand *</label>
              <input name="brand" required defaultValue={product?.brand} style={inp} placeholder="e.g. CeraVe" />
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
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

          {/* Row 3 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={fieldWrap}>
              <label style={lbl}>Category *</label>
              <input name="category" required defaultValue={product?.category} style={inp} placeholder="e.g. Skincare" />
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

          {/* Image URL */}
          <div style={{ ...fieldWrap, marginBottom: 16 }}>
            <label style={lbl}>Product Image URL</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <input
                name="image_url" type="url"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                style={{ ...inp, flex: 1 }}
                placeholder="https://example.com/image.jpg"
              />
              {imageUrl && (
                <div style={{
                  width: 72, height: 72, borderRadius: 8, overflow: 'hidden',
                  border: '1px solid #e5e7eb', flexShrink: 0, background: '#f9fafb',
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl} alt="preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Content fields */}
          <div style={{ ...fieldWrap, marginBottom: 16 }}>
            <label style={lbl}>Description</label>
            <textarea name="description" defaultValue={product?.description ?? ''} rows={3}
              style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Short product description shown on the product page…" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
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
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
            <button type="submit" disabled={pending} style={{
              padding: '10px 24px', background: pending ? '#9ca3af' : '#ec4899',
              color: 'white', border: 'none', borderRadius: 7,
              fontSize: '0.875rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer',
            }}>
              {pending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Product'}
            </button>
            <Link href="/admin/products" style={{
              padding: '10px 20px', background: 'white', color: '#374151',
              border: '1px solid #d1d5db', borderRadius: 7,
              fontSize: '0.875rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
            }}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
