'use client';
import { startTransition, useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { createProduct, updateProduct } from '@/app/admin/actions';
import { ImageUpload } from './ImageUpload';
import { KeyBenefitsEditor, FaqEditor } from './ProductContentEditors';
import { SubmitToIndexButton } from './IndexingButtons';
import { TAXONS } from '@/lib/category-taxonomy';
import { STOCK_MODES } from '@/types';
import type { Product, StockMode, Vendor } from '@/types';

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
const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 };
const row3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 };

// One titled block of the form. Sections are separated by a hairline so a
// long product edit reads as grouped steps, not one undifferentiated wall.
// Section titles in render order, also drives the "jump to" nav. Keep in
// sync with the <Section> blocks below.
const FORM_SECTIONS = ['Basics', 'Merchandising', 'Pricing & stock', 'Vendor & sourcing', 'Page link', 'Product image', 'Product-page content', 'Search & social'];

function Section({ title, desc, first, children }: {
  title: string; desc?: string; first?: boolean; children: React.ReactNode;
}) {
  return (
    <section id={toSlug(title)} style={{
      marginBottom: 24, paddingTop: first ? 0 : 24,
      borderTop: first ? 'none' : '1px solid #f3f4f6',
      scrollMarginTop: 72,
    }}>
      <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#111827' }}>{title}</h2>
      <p style={{ margin: '2px 0 16px', fontSize: '0.75rem', color: '#6b7280' }}>
        {desc ?? ' '}
      </p>
      {children}
    </section>
  );
}

export function ProductForm({ product, vendors = [], initialName, linkedPosts = [] }: {
  product?: Product;
  vendors?: Vendor[];
  initialName?: string;
  /** Journal posts whose body links to this product (dead links if unpublished). */
  linkedPosts?: Array<{ id: string; title: string }>;
}) {
  const isEdit = Boolean(product);
  const boundAction = isEdit ? updateProduct.bind(null, product!.id) : createProduct;
  const [state, action, pending] = useActionState(boundAction, null);

  // Warn before leaving with unsaved edits (tab close / refresh / external
  // nav). Suppressed while submitting, a successful save redirects away.
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty || pending) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, pending]);

  // `initialName` pre-fills a brand-new product from an external prompt (e.g.
  // the Search-demand report's "Create product" action seeds the searched term
  // as the name). Only applies when creating, an edit always uses the product.
  const [name, setName] = useState(product?.name ?? initialName ?? '');
  // Tracks the status <select> so the unpublish warning can react to it.
  const [statusPick, setStatusPick] = useState(product?.status ?? 'draft');
  const [slug, setSlug] = useState(product?.slug ?? '');
  // stock_mode is the source of truth; track_inventory is derived from it by a
  // DB trigger. Fall back to the boolean for rows saved before the column
  // existed — an untracked row with a vendor is external, otherwise uncounted.
  const [stockMode, setStockMode] = useState<StockMode>(
    product?.stock_mode
      ?? (product?.track_inventory === false
            ? (product?.vendor_id ? 'external' : 'untracked')
            : 'own'),
  );
  const trackInv = stockMode === 'own';
  // Tracked so the vendor margin readout updates as the owner edits.
  const [price, setPrice] = useState<number>(product?.price ?? 0);
  const [vendorId, setVendorId] = useState(product?.vendor_id ?? '');
  const [vendorCost, setVendorCost] = useState(product?.vendor_cost != null ? String(product.vendor_cost) : '');
  const [costPrice, setCostPrice] = useState(product?.cost_price != null ? String(product.cost_price) : '');

  // Margin preview: explicit per-product cost wins; otherwise derive the cost
  // from the selected vendor's commission %.
  const selectedVendor = vendors.find(v => v.id === vendorId) ?? null;
  const costNum = vendorCost.trim() !== '' ? Number(vendorCost) : null;
  let marginInfo: { cost: number; margin: number; basis: string } | null = null;
  if (vendorId && price > 0) {
    if (costNum != null && Number.isFinite(costNum)) {
      marginInfo = { cost: costNum, margin: price - costNum, basis: 'per-product cost' };
    } else if (selectedVendor?.commission_pct != null) {
      const margin = price * (selectedVendor.commission_pct / 100);
      marginInfo = { cost: price - margin, margin, basis: `${selectedVendor.commission_pct}% commission` };
    }
  }

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

      <div style={{ background: 'white', borderRadius: 10, padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', maxWidth: 820 }}>
        {/* Jump-to nav, a long product edit is a lot of scrolling; these
            anchor chips drop you straight to a section. Sticky so they stay
            reachable as you scroll. */}
        <nav aria-label="Jump to section" style={{
          position: 'sticky', top: 0, zIndex: 4, background: 'rgba(255,255,255,0.94)',
          backdropFilter: 'saturate(140%) blur(6px)', WebkitBackdropFilter: 'saturate(140%) blur(6px)',
          margin: '-28px -28px 20px', padding: '12px 28px', borderBottom: '1px solid #f3f4f6',
          display: 'flex', gap: 6, overflowX: 'auto', borderRadius: '10px 10px 0 0',
        }}>
          {FORM_SECTIONS.map(s => (
            <a key={s} href={`#${toSlug(s)}`} style={{
              flexShrink: 0, padding: '5px 11px', borderRadius: 999, border: '1px solid #e5e7eb',
              fontSize: '0.75rem', fontWeight: 600, color: '#374151', textDecoration: 'none', background: 'white', whiteSpace: 'nowrap',
            }}>{s}</a>
          ))}
        </nav>
        {state?.error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '10px 14px', marginBottom: 20, color: '#dc2626', fontSize: '0.875rem' }}>
            {state.error}
          </div>
        )}

        {/* Submitted manually (preventDefault + startTransition) instead of via
            the `action` prop: React resets every uncontrolled field once a
            form action settles, so a rejected save (e.g. duplicate slug) used
            to wipe the merchant's entered data. Dispatching the same
            useActionState action ourselves keeps the DOM state intact while
            error/pending behave identically. */}
        <form
          onSubmit={e => {
            e.preventDefault();
            setDirty(false);
            const formData = new FormData(e.currentTarget);
            startTransition(() => action(formData));
          }}
          onInput={() => { if (!dirty) setDirty(true); }}
        >
          {/* ── Basics ─────────────────────────────────────────────────── */}
          <Section title="Basics" first>
            <div className="adm-form-2col" style={row2}>
              <div style={fieldWrap}>
                <label style={lbl}>Brand</label>
                <input name="brand" defaultValue={product?.brand ?? ''} style={inp} placeholder="e.g. CeraVe, blank for own-label" />
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

            <div className="adm-form-2col" style={row2}>
              <div style={fieldWrap}>
                <label style={lbl}>Category *</label>
                <select name="category" required defaultValue={product?.category ?? ''} style={inp}>
                  <option value="" disabled>— Select —</option>
                  {TAXONS.map(t => (
                    <optgroup key={t.key} label={t.label}>
                      {t.categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
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
            </div>

            <div className="adm-form-2col" style={row2}>
              <div style={fieldWrap}>
                <label style={lbl}>Variant</label>
                <input name="variant" defaultValue={product?.variant ?? ''} style={inp} placeholder="e.g. 250ml" />
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>Type</label>
                <select name="kind" defaultValue={product?.kind ?? 'simple'} style={inp}>
                  <option value="simple">Simple (single SKU)</option>
                  <option value="variable">Variable (with variants)</option>
                  <option value="bundle">Bundle / grouped</option>
                  <option value="external">External</option>
                </select>
                <span style={hint}>Variable products manage stock per variant.</span>
              </div>
            </div>

            <div className="adm-form-2col" style={row2}>
              <div style={fieldWrap}>
                <label style={lbl}>Packaging</label>
                <select name="packaging" defaultValue={product?.packaging ?? 'standard'} style={inp}>
                  <option value="standard">Standard (boxed)</option>
                  <option value="tester">Tester (fragrances)</option>
                  <option value="no_box">Without box</option>
                </select>
                <span style={hint}>Genuine items sold without full retail packaging show a disclosure badge on the storefront. Testers feed the &ldquo;Perfume Testers&rdquo; collection.</span>
              </div>
            </div>

            <div className="adm-form-2col" style={{ ...row2, marginBottom: 0 }}>
              <div style={fieldWrap}>
                <label style={lbl}>Status *</label>
                {/* New products start as drafts so a half-finished page never
                    goes live (or gets pinged to search engines) by accident.
                    Archived products keep their option so an edit doesn't
                    silently resurrect them. */}
                <select
                  name="status"
                  required
                  defaultValue={product?.status ?? 'draft'}
                  style={inp}
                  onChange={e => setStatusPick(e.target.value as 'draft' | 'published' | 'archived')}
                >
                  <option value="draft">Draft (hidden from storefront)</option>
                  <option value="published">Published (live)</option>
                  {product?.status === 'archived' && <option value="archived">Archived</option>}
                </select>
                <span style={hint}>Drafts are only visible in the admin. Publishing submits the page to search engines.</span>
                {/* Unpublish warning: live journal articles link to this page;
                    taking it down 404s those links until the posts are edited. */}
                {product?.status === 'published' && statusPick !== 'published' && linkedPosts.length > 0 && (
                  <div role="alert" style={{ marginTop: 8, padding: '10px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: '0.8125rem', color: '#92400e' }}>
                    <strong>{linkedPosts.length === 1 ? '1 journal post links' : `${linkedPosts.length} journal posts link`} to this product.</strong>{' '}
                    Unpublishing will leave {linkedPosts.length === 1 ? 'a dead link' : 'dead links'} in:
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      {linkedPosts.map(bp => (
                        <li key={bp.id}>
                          <a href={`/admin/blog/${bp.id}`} target="_blank" rel="noreferrer" style={{ color: '#92400e', textDecoration: 'underline' }}>{bp.title}</a>
                        </li>
                      ))}
                    </ul>
                    Update or unlink those mentions after saving.
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* ── Merchandising ──────────────────────────────────────────── */}
          <Section title="Merchandising" desc="Surface this product on the homepage rails and in the Featured / Bestsellers collections.">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', flex: '1 1 240px' }}>
                <input type="checkbox" name="is_featured" defaultChecked={product?.is_featured ?? false} style={{ marginTop: 2, accentColor: '#C5286A' }} />
                <span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Featured</span>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>Show in the homepage “Featured” rail and the Featured smart collection.</span>
                </span>
              </label>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', flex: '1 1 240px' }}>
                <input type="checkbox" name="is_bestseller" defaultChecked={product?.is_bestseller ?? false} style={{ marginTop: 2, accentColor: '#C5286A' }} />
                <span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Bestseller</span>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>Show in the homepage “Bestsellers” rail and the Bestsellers smart collection.</span>
                </span>
              </label>
            </div>
          </Section>

          {/* ── Pricing & stock ────────────────────────────────────────── */}
          <Section title="Pricing & stock">
            <div className="adm-form-3col" style={{ ...row3, marginBottom: 16 }}>
              <div style={fieldWrap}>
                <label style={lbl}>Price (PKR) *</label>
                <input name="price" type="number" required min={0} defaultValue={product?.price} style={inp} placeholder="2400"
                  onChange={e => setPrice(Number(e.target.value) || 0)} />
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>Original Price (PKR)</label>
                <input name="original_price" type="number" min={0} defaultValue={product?.original_price ?? ''} style={inp} placeholder="3000" />
                <span style={hint}>Set higher than price to show a strikethrough sale.</span>
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>Stock Quantity{trackInv ? ' *' : ''}</label>
                {trackInv ? (
                  <input name="stock" type="number" required min={0} defaultValue={product?.stock ?? 0} style={inp} placeholder="0" />
                ) : (
                  <>
                    <div style={{ ...inp, color: '#6b7280', background: '#f9fafb', display: 'flex', alignItems: 'center' }}>
                      {stockMode === 'external' ? 'Held by the vendor' : 'Not counted'}
                    </div>
                  </>
                )}
              </div>
            </div>
            {/* stock_mode is what we submit; the DB trigger derives
                track_inventory from it. */}
            <input type="hidden" name="stock_mode" value={stockMode} />
            <fieldset style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', padding: '12px 14px', margin: 0 }}>
              <legend style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', padding: '0 6px' }}>
                Who holds this stock?
              </legend>
              {STOCK_MODES.map(m => (
                <label
                  key={m.value}
                  style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '6px 0' }}
                >
                  <input
                    type="radio"
                    name="stock_mode_choice"
                    value={m.value}
                    checked={stockMode === m.value}
                    onChange={() => setStockMode(m.value)}
                    style={{ marginTop: 3, accentColor: '#C5286A' }}
                  />
                  <span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>{m.label}</span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{m.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {trackInv && (
              <div style={{ ...fieldWrap, marginTop: 16, maxWidth: 240 }}>
                <label style={lbl}>Reorder point</label>
                <input name="reorder_point" type="number" min={0} defaultValue={product?.reorder_point ?? 0} style={inp} placeholder="0" />
                <span style={hint}>Flag this product for reorder when stock falls to this level. 0 = use the global low-stock alert.</span>
              </div>
            )}
          </Section>

          {/* ── Vendor & sourcing ──────────────────────────────────────── */}
          <Section title="Vendor & sourcing" desc="Where this product comes from and what it costs you. Order margins and payouts always come from the vendor selected on the order — these fields feed suggestions and per-unit costs into that.">
            <div className="adm-form-2col" style={row2}>
              <div style={fieldWrap}>
                <label style={lbl}>Default supplier</label>
                <select name="vendor_id" value={vendorId} onChange={e => setVendorId(e.target.value)} style={inp}>
                  <option value="">— None (own stock) —</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name}{v.commission_pct != null ? ` · ${v.commission_pct}% commission` : ''}
                    </option>
                  ))}
                </select>
                <span style={hint}>
                  Who normally sources this product. Groups reorder suggestions in Inventory and
                  is offered one-click as the fulfilment vendor on orders containing this item —
                  it does not by itself assign a vendor to any order.
                </span>
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>Vendor cost (PKR)</label>
                <input
                  name="vendor_cost" type="number" min={0} step="0.01"
                  value={vendorCost} onChange={e => setVendorCost(e.target.value)}
                  style={inp} placeholder="Leave blank to use the order vendor's commission %"
                />
                <span style={hint}>
                  Fixed price you pay per unit when an order with this item is fulfilled by a
                  vendor. Overrides that vendor&apos;s commission % for this item only.
                </span>
              </div>
            </div>
            <div style={fieldWrap}>
              <label style={lbl}>Cost price (PKR)</label>
              <input
                name="cost_price" type="number" min={0} step="0.01"
                value={costPrice} onChange={e => setCostPrice(e.target.value)}
                style={inp} placeholder="What you paid per unit (own stock)"
              />
              <span style={hint}>Your acquisition cost per unit for own-stock items. Powers the profit / COGS figures in Finance. Vendor items use the vendor cost above instead.</span>
            </div>
            {vendorId && (
              <div style={{
                marginTop: 4, padding: '12px 14px', borderRadius: 8,
                background: marginInfo ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${marginInfo ? '#bbf7d0' : '#fde68a'}`,
                fontSize: '0.8125rem',
              }}>
                {marginInfo ? (
                  <>
                    <strong style={{ color: '#16a34a' }}>
                      Margin: PKR {Math.round(marginInfo.margin).toLocaleString()}
                    </strong>
                    <span style={{ color: '#6b7280' }}>
                      {' '}· cost PKR {Math.round(marginInfo.cost).toLocaleString()}
                      {price > 0 ? ` · ${Math.round((marginInfo.margin / price) * 100)}% of price` : ''}
                      {' '}({marginInfo.basis})
                    </span>
                  </>
                ) : (
                  <span style={{ color: '#92400e' }}>
                    Set a vendor cost above, or a commission % on the vendor, to see the margin.
                  </span>
                )}
              </div>
            )}
          </Section>

          {/* ── Link / slug ────────────────────────────────────────────── */}
          <Section title="Page link" desc="The product's URL slug.">
            <div style={fieldWrap}>
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
          </Section>

          {/* ── Image ──────────────────────────────────────────────────── */}
          <Section title="Product image">
            <ImageUpload name="image_url" currentUrl={product?.image_url} label="" aspect={1} />
          </Section>

          {/* ── Video ──────────────────────────────────────────────────── */}
          <Section title="Product video" desc="Optional short clip (e.g. a makeup swatch). Shown as a tap-to-play slide in the gallery, never autoplays, lazy-loaded so it doesn't slow the page. MP4/WebM, max 30 MB.">
            <ImageUpload name="video_url" kind="video" currentUrl={product?.video_url} label="" aspect={1} />
          </Section>

          {/* ── Product-page content ───────────────────────────────────── */}
          <Section title="Product-page content" desc="Shown on the customer-facing product page. All optional.">
            <div style={{ ...fieldWrap, marginBottom: 16 }}>
              <label style={lbl}>Description</label>
              <textarea name="description" defaultValue={product?.description ?? ''} rows={3}
                style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="Short product description shown on the product page…" />
            </div>

            <div className="adm-form-2col" style={row2}>
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

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Key benefits</label>
              <KeyBenefitsEditor name="key_benefits" initial={product?.key_benefits} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>FAQ</label>
              <FaqEditor name="faq" initial={product?.faq} />
            </div>

            <div className="adm-form-2col" style={{ ...row2, marginBottom: 0 }}>
              <div style={fieldWrap}>
                <label style={lbl}>Usage tips</label>
                <textarea name="usage_tips" defaultValue={product?.usage_tips ?? ''} rows={4}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="Care tips, layering advice, or seasonal notes." />
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>Social proof</label>
                <textarea name="social_proof" defaultValue={product?.social_proof ?? ''} rows={4} maxLength={500}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder={'e.g. "Featured in Vogue Pakistan, July 2025."'} />
              </div>
            </div>
          </Section>

          {/* ── Search & social (SEO) ──────────────────────────────────── */}
          <Section title="Search & social" desc="Leave blank to fall back to auto-generated values.">
            <div className="adm-form-2col" style={row2}>
              <div style={fieldWrap}>
                <label style={lbl}>SEO title</label>
                <input name="seo_title" type="text" defaultValue={product?.seo_title ?? ''} maxLength={120}
                  placeholder='e.g. "CeraVe Hydrating Cleanser, Buy in Pakistan"' style={inp} />
                <span style={hint}>Auto-default: brand + name. ≤60 chars ideal.</span>
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>OG image URL</label>
                <input name="og_image_url" type="url" defaultValue={product?.og_image_url ?? ''} maxLength={500}
                  placeholder="https://… (defaults to the product image)" style={inp} />
              </div>
            </div>
            <div style={fieldWrap}>
              <label style={lbl}>SEO description</label>
              <textarea name="seo_description" defaultValue={product?.seo_description ?? ''} rows={2} maxLength={220}
                style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="One-paragraph pitch with the keyword + COD/Pakistan signal." />
              <span style={hint}>Auto-default: description / generic. ≤160 chars ideal.</span>
            </div>
          </Section>

          {/* Sticky save bar, pins to the bottom of the viewport while the
              admin scrolls long product edits. */}
          <div
            className="adm-sticky-actions"
            style={{
              position: 'sticky', bottom: 0,
              marginTop: 8,
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
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {isEdit && product?.slug && <SubmitToIndexButton path={`/product/${product.slug}`} />}
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
