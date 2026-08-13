'use client';

import { useActionState, useState } from 'react';
import { createVariant, updateVariant, deleteVariant, createAttribute, createAttributeValue, removeValueFromProduct } from '@/app/admin/variant-actions';
import type { ProductAttribute, AttributeValue, ProductVariant } from '@/types';

interface AttributeWithValues extends ProductAttribute {
  values: AttributeValue[];
}

interface VariantWithOptions extends ProductVariant {
  option_value_ids: string[];
}

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px',
  border: '1px solid #d1d5db', borderRadius: 6,
  fontSize: '0.8125rem', color: '#111827',
  background: 'white', outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 };

function describeOptions(v: VariantWithOptions, attrs: AttributeWithValues[]): string {
  return attrs
    .map(a => {
      const matchValueId = v.option_value_ids.find(id => a.values.some(av => av.id === id));
      const val = matchValueId ? a.values.find(av => av.id === matchValueId)?.value : null;
      return val ? `${a.name}: ${val}` : null;
    })
    .filter(Boolean)
    .join(' · ') || '(no options)';
}

// ─── Single variant row form (create + edit share this) ────────────────────
function VariantForm({
  productId, attributes, variant, onDone, stockCounted = true,
}: {
  productId: string;
  attributes: AttributeWithValues[];
  variant?: VariantWithOptions;
  onDone?: () => void;
  /** false when the product's stock_mode is external/untracked: the shades
   *  then have nothing to count either, so no stock input is shown or sent. */
  stockCounted?: boolean;
}) {
  const action = variant ? updateVariant.bind(null, variant.id) : createVariant;
  const [state, formAction, pending] = useActionState(action, null);

  // When state.success flips, collapse this form (parent decides).
  if (state?.success && onDone) {
    setTimeout(onDone, 50);
  }

  return (
    <form action={formAction} style={{
      padding: 16, background: '#f9fafb', border: '1px solid #e5e7eb',
      borderRadius: 8, marginBottom: 12,
    }}>
      <input type="hidden" name="product_id" value={productId} />
      {state?.error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 12, color: '#dc2626', fontSize: '0.75rem' }}>
          {state.error}
        </div>
      )}

      {/* Attribute selectors */}
      {attributes.length > 0 && (
        <div className="adm-variant-attrs" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(attributes.length, 3)}, 1fr)`, gap: 12, marginBottom: 12 }}>
          {attributes.map(a => {
            const current = variant?.option_value_ids.find(id => a.values.some(av => av.id === id)) ?? '';
            return (
              <div key={a.id}>
                <label style={lbl}>{a.name}</label>
                <select name={`option__${a.id}`} defaultValue={current} style={inp}>
                  <option value="">—</option>
                  {a.values.map(v => (
                    <option key={v.id} value={v.id}>{v.value}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}

      <div className="adm-form-4col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={lbl}>SKU</label>
          <input name="sku" defaultValue={variant?.sku ?? ''} style={inp} placeholder="SKU-001" />
        </div>
        <div>
          <label style={lbl}>Price (PKR) *</label>
          <input name="price" type="number" min={0} required defaultValue={variant?.price ?? ''} style={inp} placeholder="2400" />
        </div>
        <div>
          <label style={lbl}>Compare at</label>
          <input name="compare_at_price" type="number" min={0} defaultValue={variant?.compare_at_price ?? ''} style={inp} placeholder="3000" />
        </div>
        <div>
          <label style={lbl}>Stock{stockCounted ? ' *' : ''}</label>
          {stockCounted ? (
            <input name="stock" type="number" min={0} required defaultValue={variant?.stock ?? 0} style={inp} placeholder="0" />
          ) : (
            /* Vendor-held / uncounted product: the shades have nothing to
               count either. No input, nothing submitted, and the server
               ignores stock for these products regardless. */
            <div style={{ ...inp, color: '#6b7280', background: '#f3f4f6', display: 'flex', alignItems: 'center' }}>
              Not counted
            </div>
          )}
        </div>
      </div>

      <div className="adm-form-3col" style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={lbl}>Image URL</label>
          <input name="image_url" defaultValue={variant?.image_url ?? ''} style={inp} placeholder="https://…" />
        </div>
        <div>
          <label style={lbl}>Sort order</label>
          <input name="sort_order" type="number" min={0} defaultValue={variant?.sort_order ?? 0} style={inp} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', paddingTop: 18 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', cursor: 'pointer' }}>
            {/* Hidden 'false' before the checkbox so an unticked box submits a
                value and can actually disable the variant (see variantInputSchema). */}
            <input type="hidden" name="enabled" value="false" />
            <input name="enabled" type="checkbox" defaultChecked={variant?.enabled ?? true} value="true" />
            Enabled
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="submit" disabled={pending} style={{
          padding: '8px 16px', background: pending ? '#9ca3af' : '#C5286A',
          color: 'white', border: 'none', borderRadius: 6,
          fontSize: '0.8125rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer',
        }}>
          {pending ? 'Saving…' : variant ? 'Save changes' : 'Create variant'}
        </button>
        {state?.success && <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>✓ Saved</span>}
        {onDone && (
          <button type="button" onClick={onDone} style={{
            padding: '8px 12px', background: 'transparent', color: '#6b7280',
            border: '1px solid #d1d5db', borderRadius: 6,
            fontSize: '0.8125rem', cursor: 'pointer',
          }}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// ─── Add a new attribute value (a shade that isn't listed yet) ─────────────
// Its own <form>, never nested inside a VariantForm: the new value lands in
// every variant dropdown on save, so it lives at section level.
function AddValueForm({ productId, attributes }: { productId: string; attributes: AttributeWithValues[] }) {
  const [state, formAction, pending] = useActionState(createAttributeValue, null);
  return (
    <form action={formAction} style={{
      display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap',
      padding: '12px 14px', background: '#f9fafb', border: '1px dashed #d1d5db',
      borderRadius: 8, marginBottom: 14,
    }}>
      <input type="hidden" name="product_id" value={productId} />
      <div style={{ minWidth: 140 }}>
        <label style={lbl}>New value for</label>
        <select name="attribute_id" required defaultValue={attributes.length === 1 ? attributes[0].id : ''} style={inp}>
          {attributes.length !== 1 && <option value="" disabled>Attribute…</option>}
          {attributes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div style={{ flex: '1 1 180px' }}>
        <label style={lbl}>Value</label>
        <input name="value" required maxLength={120} placeholder="e.g. Barcelona, 50ml, Rose Gold" style={inp} />
      </div>
      <button type="submit" disabled={pending} style={{
        padding: '8px 14px', background: pending ? '#9ca3af' : '#111827', color: 'white',
        border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
      }}>
        {pending ? 'Adding…' : '+ Add value'}
      </button>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#374151', cursor: 'pointer', paddingBottom: 8 }}>
        <input type="checkbox" name="create_variant" value="true" defaultChecked />
        also create its variant (product&apos;s price, 0 stock)
      </label>
      {state?.error && (
        <span style={{ fontSize: '0.75rem', color: '#dc2626', flexBasis: '100%' }}>{state.error}</span>
      )}
      {state?.success && (
        <span style={{ fontSize: '0.75rem', color: '#065f46', flexBasis: '100%' }}>
          Added — set its stock and price below.
        </span>
      )}
    </form>
  );
}

// ─── Product options overview: what this product varies on, chip per value ──
// The Shopify view of the same data: each value this product's variants use,
// removable with ×. Removal deletes this product's empty variants carrying the
// value (refused while stock remains) and never touches other products.
function ValueChip({ productId, valueId, label }: { productId: string; valueId: string; label: string }) {
  const [state, formAction, pending] = useActionState(removeValueFromProduct, null);
  return (
    <>
      <form action={formAction} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #d1d5db', borderRadius: 14, padding: '3px 6px 3px 12px', fontSize: '0.75rem', color: '#374151' }}>
        <input type="hidden" name="product_id" value={productId} />
        <input type="hidden" name="value_id" value={valueId} />
        {label}
        <button
          type="submit"
          disabled={pending}
          title={`Remove ${label} from this product`}
          style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 18, height: 18, lineHeight: 1, fontSize: '0.75rem', color: '#6b7280', cursor: 'pointer' }}
        >
          {pending ? '…' : '×'}
        </button>
      </form>
      {state?.error && (
        <span style={{ flexBasis: '100%', fontSize: '0.75rem', color: '#dc2626' }}>{state.error}</span>
      )}
    </>
  );
}

function OptionsCard({ productId, attributes, variants }: {
  productId: string;
  attributes: AttributeWithValues[];
  variants: VariantWithOptions[];
}) {
  const usedValueIds = new Set(variants.flatMap(v => v.option_value_ids));
  const rows = attributes
    .map(a => ({ attr: a, used: a.values.filter(v => usedValueIds.has(v.id)) }))
    .filter(r => r.used.length > 0);
  if (rows.length === 0) return null;
  return (
    <div style={{ marginBottom: 14, padding: '12px 14px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      {rows.map(({ attr, used }) => (
        <div key={attr.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '4px 0' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: 70 }}>{attr.name}</span>
          {used.map(v => (
            <ValueChip key={v.id} productId={productId} valueId={v.id} label={v.value} />
          ))}
        </div>
      ))}
      <p style={{ margin: '6px 0 0', fontSize: '0.6875rem', color: '#9ca3af' }}>
        × removes that value&apos;s variant from this product (only when its stock is zero). Other products keep the value.
      </p>
    </div>
  );
}

// ─── First attribute for a catalogue that has none ─────────────────────────
function CreateAttributeForm({ productId }: { productId: string }) {
  const [state, formAction, pending] = useActionState(createAttribute, null);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap', marginTop: 12 }}>
      <input type="hidden" name="product_id" value={productId} />
      <div style={{ minWidth: 160 }}>
        <label style={lbl}>Attribute name</label>
        <input name="name" required maxLength={80} placeholder="e.g. Shade" style={inp} />
      </div>
      <div style={{ flex: '1 1 180px' }}>
        <label style={lbl}>Its first value</label>
        <input name="first_value" required maxLength={120} placeholder="e.g. Orgasm" style={inp} />
      </div>
      <button type="submit" disabled={pending} style={{
        padding: '8px 14px', background: pending ? '#9ca3af' : '#C5286A', color: 'white',
        border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
      }}>
        {pending ? 'Creating…' : 'Create attribute'}
      </button>
      {state?.error && <span style={{ fontSize: '0.75rem', color: '#dc2626', flexBasis: '100%' }}>{state.error}</span>}
    </form>
  );
}

// ─── Main section ──────────────────────────────────────────────────────────
export function VariantsSection({
  productId, productKind, attributes, variants, stockCounted = true,
}: {
  productId: string;
  productKind: string;
  attributes: AttributeWithValues[];
  variants: VariantWithOptions[];
  /** false for vendor-held / uncounted products (stock_mode !== 'own'). */
  stockCounted?: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  if (productKind !== 'variable') {
    return (
      <div style={{ padding: '24px 28px', marginTop: 24, background: 'white', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Variants</h2>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
          Change the product type to <strong>Variable</strong> above and save to start adding variants.
        </p>
      </div>
    );
  }

  if (attributes.length === 0) {
    return (
      <div style={{ padding: '24px 28px', marginTop: 24, background: 'white', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Variants</h2>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
          Variants need an attribute — the axis they vary on, like Shade or Size. Create the first one
          and its first value, then add variants against it.
        </p>
        <CreateAttributeForm productId={productId} />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', marginTop: 24, background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
          Variants ({variants.length})
        </h2>
        {!adding && (
          <button onClick={() => setAdding(true)} style={{
            padding: '8px 14px', background: '#C5286A', color: 'white',
            border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
          }}>+ Add variant</button>
        )}
      </div>

      {/* What this product varies on, at a glance — with per-value removal. */}
      <OptionsCard productId={productId} attributes={attributes} variants={variants} />

      {/* A shade/size that isn't listed yet gets added here and immediately
          appears in every variant dropdown below. */}
      <AddValueForm productId={productId} attributes={attributes} />

      {adding && (
        <VariantForm
          productId={productId}
          attributes={attributes}
          onDone={() => setAdding(false)}
          stockCounted={stockCounted}
        />
      )}

      {variants.length === 0 && !adding && (
        <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.8125rem' }}>
          No variants yet. Click <strong>+ Add variant</strong> to create one.
        </div>
      )}

      {variants.map(v => (
        <div key={v.id}>
          {editingId === v.id ? (
            <VariantForm
              productId={productId}
              attributes={attributes}
              variant={v}
              onDone={() => setEditingId(null)}
              stockCounted={stockCounted}
            />
          ) : (
            <div
              className="adm-variant-row"
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto auto',
                alignItems: 'center', gap: 12,
                padding: '12px 14px', border: '1px solid #e5e7eb',
                borderRadius: 8, marginBottom: 8,
                opacity: v.enabled ? 1 : 0.55,
              }}
            >
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{describeOptions(v, attributes)}</div>
                {v.sku && <div style={{ fontSize: '0.6875rem', color: '#9ca3af', fontFamily: 'monospace' }}>{v.sku}</div>}
              </div>
              <div style={{ fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                PKR {v.price.toLocaleString()}
                {(v.compare_at_price ?? 0) > v.price && (
                  <span style={{ marginLeft: 6, color: '#9ca3af', textDecoration: 'line-through', fontSize: '0.6875rem' }}>
                    {(v.compare_at_price ?? 0).toLocaleString()}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8125rem' }}>
                {stockCounted
                  ? <>Stock: <strong>{v.stock}</strong></>
                  : <span style={{ color: '#9ca3af' }}>Stock: not counted</span>}
              </div>
              <div style={{ fontSize: '0.6875rem', color: v.enabled ? '#16a34a' : '#9ca3af' }}>
                {v.enabled ? '● enabled' : '○ disabled'}
              </div>
              <button onClick={() => setEditingId(v.id)} style={{
                padding: '6px 12px', background: 'transparent', color: '#374151',
                border: '1px solid #d1d5db', borderRadius: 6,
                fontSize: '0.75rem', cursor: 'pointer',
              }}>
                Edit
              </button>
              <form action={deleteVariant}>
                <input type="hidden" name="id" value={v.id} />
                <input type="hidden" name="product_id" value={productId} />
                <button type="submit" style={{
                  padding: '6px 10px', background: 'transparent', color: '#dc2626',
                  border: '1px solid #fecaca', borderRadius: 6,
                  fontSize: '0.75rem', cursor: 'pointer',
                }}>
                  Delete
                </button>
              </form>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
