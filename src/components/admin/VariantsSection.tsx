'use client';

import { useActionState, useState } from 'react';
import { createVariant, updateVariant, deleteVariant, createAttribute, createAttributeValue, removeValueFromProduct, bulkUpdateVariants, deleteAttribute } from '@/app/admin/variant-actions';
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
function AddValueForm({ productId, attributes, multiOption }: {
  productId: string;
  attributes: AttributeWithValues[];
  /** True when this product's variants span more than one option axis — the
   *  one-click variant would be unreachable, so the shortcut is hidden. */
  multiOption: boolean;
}) {
  const [state, formAction, pending] = useActionState(createAttributeValue, null);
  const [attrState, deleteAttrAction, attrPending] = useActionState(deleteAttribute, null);
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
      {!multiOption && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#374151', cursor: 'pointer', paddingBottom: 8 }}>
          <input type="checkbox" name="create_variant" value="true" defaultChecked />
          also create its variant (product&apos;s price, 0 stock)
        </label>
      )}
      {/* The undo for a mistaken attribute: deletes the SELECTED attribute,
          server-guarded to attributes no variant anywhere uses. */}
      <button
        type="submit"
        formAction={deleteAttrAction}
        formNoValidate
        disabled={attrPending}
        title="Delete the selected attribute (only possible while nothing uses it)"
        style={{ padding: '8px 12px', background: 'transparent', color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer' }}
      >
        {attrPending ? 'Deleting…' : 'Delete attribute'}
      </button>
      {attrState?.error && (
        <span style={{ fontSize: '0.75rem', color: '#dc2626', flexBasis: '100%' }}>{attrState.error}</span>
      )}
      {attrState?.success && (
        <span style={{ fontSize: '0.75rem', color: '#065f46', flexBasis: '100%' }}>Attribute deleted.</span>
      )}
      {state?.error && (
        <span style={{ fontSize: '0.75rem', color: '#dc2626', flexBasis: '100%' }}>{state.error}</span>
      )}
      {state?.success && (
        <span style={{ fontSize: '0.75rem', color: '#065f46', flexBasis: '100%' }}>
          {state.note ?? 'Added — set its stock and price below.'}
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
      <AddValueForm
        productId={productId}
        attributes={attributes}
        multiOption={(() => {
          const used = new Set(variants.flatMap(v => v.option_value_ids));
          return attributes.filter(a => a.values.some(v => used.has(v.id))).length > 1;
        })()}
      />

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

      {/* Details editor for one variant (image, options, sort order). Rendered
          here because a form cannot nest inside the grid form below. */}
      {editingId && variants.some(v => v.id === editingId) && (
        <VariantForm
          productId={productId}
          attributes={attributes}
          variant={variants.find(v => v.id === editingId)!}
          onDone={() => setEditingId(null)}
          stockCounted={stockCounted}
        />
      )}

      {variants.length > 0 && (
        <VariantGrid
          productId={productId}
          attributes={attributes}
          variants={variants}
          stockCounted={stockCounted}
          onDetails={setEditingId}
        />
      )}

    </div>
  );
}

// ─── The grid: every variant editable on one screen, one Save ──────────────
// The Shopify variant table. sku / price / compare-at / stock / status are
// inline inputs; a single submit saves only the rows that changed (the server
// diffs against the database). Stock writes go through the ledger, and the
// stock column collapses to "not counted" for vendor-held products. Details
// (image, options, sort) live behind the per-row Details button, and Delete
// posts the same form to the delete action via the button's own name/value.
function VariantGrid({ productId, attributes, variants, stockCounted, onDetails }: {
  productId: string;
  attributes: AttributeWithValues[];
  variants: VariantWithOptions[];
  stockCounted: boolean;
  onDetails: (id: string) => void;
}) {
  const [state, formAction, pending] = useActionState(bulkUpdateVariants, null);
  const gth: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' };
  const gtd: React.CSSProperties = { padding: '6px 10px', verticalAlign: 'middle' };
  const gin: React.CSSProperties = { ...inp, padding: '6px 8px', fontSize: '0.8125rem' };

  return (
    <form action={formAction}>
      <input type="hidden" name="product_id" value={productId} />
      <div className="adm-table-scroll" style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={gth}>Variant</th>
              <th style={gth}>SKU</th>
              <th style={{ ...gth, width: 110 }}>Price</th>
              <th style={{ ...gth, width: 110 }}>Compare-at</th>
              <th style={{ ...gth, width: 90 }}>{stockCounted ? 'Stock' : 'Stock'}</th>
              <th style={{ ...gth, width: 96 }}>Status</th>
              <th style={gth}></th>
            </tr>
          </thead>
          <tbody>
            {variants.map(v => (
              <tr key={v.id} style={{ borderTop: '1px solid #f3f4f6', opacity: v.enabled ? 1 : 0.6 }}>
                <td style={{ ...gtd, fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <input type="hidden" name={`v__${v.id}__present`} value="1" />
                  {describeOptions(v, attributes)}
                </td>
                <td style={gtd}>
                  <input name={`v__${v.id}__sku`} defaultValue={v.sku ?? ''} placeholder="—" style={{ ...gin, width: 110, fontFamily: 'monospace' }} />
                </td>
                <td style={gtd}>
                  <input name={`v__${v.id}__price`} type="number" min={0} step="0.01" required defaultValue={v.price} style={{ ...gin, width: 96 }} />
                </td>
                <td style={gtd}>
                  <input name={`v__${v.id}__compare`} type="number" min={0} step="0.01" defaultValue={v.compare_at_price ?? ''} placeholder="—" style={{ ...gin, width: 96 }} />
                </td>
                <td style={gtd}>
                  {stockCounted ? (
                    <input name={`v__${v.id}__stock`} type="number" min={0} step="1" defaultValue={v.stock} style={{ ...gin, width: 72 }} />
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>not counted</span>
                  )}
                </td>
                <td style={gtd}>
                  <select name={`v__${v.id}__enabled`} defaultValue={v.enabled ? 'true' : 'false'} style={{ ...gin, width: 88 }}>
                    <option value="true">Active</option>
                    <option value="false">Hidden</option>
                  </select>
                </td>
                <td style={{ ...gtd, whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button type="button" onClick={() => onDetails(v.id)} style={{
                    padding: '5px 10px', background: 'transparent', color: '#374151',
                    border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer', marginRight: 6,
                  }}>
                    Details
                  </button>
                  <button
                    type="submit"
                    formAction={deleteVariant}
                    name="id"
                    value={v.id}
                    formNoValidate
                    title="Delete this variant"
                    style={{
                      padding: '5px 10px', background: 'transparent', color: '#dc2626',
                      border: '1px solid #fecaca', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <button type="submit" disabled={pending} style={{
          padding: '8px 18px', background: pending ? '#9ca3af' : '#C5286A', color: 'white',
          border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
        }}>
          {pending ? 'Saving…' : 'Save all changes'}
        </button>
        {state?.error && <span style={{ fontSize: '0.75rem', color: '#dc2626' }}>{state.error}</span>}
        {state?.success && (
          <span style={{ fontSize: '0.75rem', color: state.changed ? '#065f46' : '#6b7280' }}>
            {state.changed ? `Saved ${state.changed} variant${state.changed === 1 ? '' : 's'}.` : 'Nothing changed.'}
          </span>
        )}
        {stockCounted && (
          <span style={{ fontSize: '0.6875rem', color: '#9ca3af', marginLeft: 'auto' }}>
            Stock edits are recorded in Movement history.
          </span>
        )}
      </div>
    </form>
  );
}
