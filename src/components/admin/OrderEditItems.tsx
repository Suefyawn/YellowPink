'use client';

// In-place line-item editing for unshipped orders (Shopify's "Edit order"),
// so a shade or quantity change on the COD confirmation call doesn't force a
// cancel-and-recreate. Wraps the Order items card: read mode renders the
// server-built table passed as children; "Edit items" swaps it for per-line
// quantity steppers (0 = remove) plus an add-line product search that mirrors
// the manual order form's shade-aware picker. The server reprices added lines
// from the catalogue and moves stock through the inventory ledger; this form
// only says WHAT changed.

import { useEffect, useState } from 'react';
import {
  editOrderItems,
  searchProductsForOrderEdit,
  type EditSearchProduct,
} from '@/app/admin/orders/edit-items-actions';

export interface EditableOrderLine {
  /** Position in orders.items — the server matches edits back by index. */
  index: number;
  name: string;
  brand: string | null;
  variantLabel: string | null;
  price: number;
  qty: number;
}

interface AddedLine {
  product_id: string;
  variant_id: string | null;
  label: string;
  price: number;
  qty: number;
}

const addedKey = (l: { product_id: string; variant_id: string | null }) => `${l.product_id}::${l.variant_id ?? ''}`;

const inp: React.CSSProperties = {
  padding: '7px 9px', border: '1px solid #d1d5db', borderRadius: 6,
  fontSize: '0.8125rem', background: 'white', boxSizing: 'border-box',
};

export function OrderEditItems({
  orderId,
  editable,
  lines,
  children,
}: {
  orderId: string;
  /** orders.edit + a pre-shipment status; false renders the read-only card. */
  editable: boolean;
  lines: EditableOrderLine[];
  /** The server-rendered read-only items table. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [qtys, setQtys] = useState<Record<number, number>>({});
  const [added, setAdded] = useState<AddedLine[]>([]);
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<EditSearchProduct[]>([]);

  // Add-line lookup: min 2 chars, debounced, server action returns published
  // products with their enabled shades (same pattern as the manual order
  // form's repeat-customer search).
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      searchProductsForOrderEdit(q)
        .then(rows => { if (!cancelled) setMatches(rows); })
        .catch(() => { if (!cancelled) setMatches([]); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search]);

  const startEditing = () => {
    setQtys(Object.fromEntries(lines.map(l => [l.index, l.qty])));
    setAdded([]);
    setSearch('');
    setMatches([]);
    setOpen(true);
  };

  const setQty = (index: number, raw: number) => {
    const qty = Math.max(0, Math.min(500, Math.round(raw)));
    setQtys(prev => ({ ...prev, [index]: Number.isFinite(qty) ? qty : 0 }));
  };

  const addLine = (p: EditSearchProduct, variantId: string | null) => {
    const v = variantId ? p.variants.find(x => x.id === variantId) ?? null : null;
    const next: AddedLine = {
      product_id: p.id,
      variant_id: v?.id ?? null,
      label: [p.brand, p.name, v?.label].filter(Boolean).join(' — '),
      // Display only — the server prices added lines from the catalogue.
      price: v?.price ?? p.price,
      qty: 1,
    };
    setAdded(prev => {
      const k = addedKey(next);
      if (prev.some(l => addedKey(l) === k)) {
        return prev.map(l => (addedKey(l) === k ? { ...l, qty: Math.min(500, l.qty + 1) } : l));
      }
      return [...prev, next];
    });
    setSearch('');
    setMatches([]);
  };

  const surviving = lines.filter(l => (qtys[l.index] ?? l.qty) > 0).length + added.length;
  const changed = added.length > 0 || lines.some(l => (qtys[l.index] ?? l.qty) !== l.qty);
  const newSubtotal =
    lines.reduce((s, l) => s + l.price * (qtys[l.index] ?? l.qty), 0) +
    added.reduce((s, l) => s + l.price * l.qty, 0);

  const label = (l: EditableOrderLine) =>
    `${l.brand ? `${l.brand} — ` : ''}${l.name}${l.variantLabel ? ` (${l.variantLabel})` : ''}`;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Order items</h2>
        {editable && !open && (
          <button onClick={startEditing} style={{
            padding: '7px 14px', background: 'white', color: '#C5286A',
            border: '1px solid #C5286A', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
          }}>
            Edit items
          </button>
        )}
      </div>

      {!open ? children : (
        <form action={editOrderItems.bind(null, orderId)} style={{ padding: '12px 14px', background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 8 }}>
          <p style={{ margin: '0 0 12px', fontSize: '0.75rem', color: '#6b7280' }}>
            Shipping and any discount stay as recorded; totals recompute from the new items.
            Stock moves through the inventory ledger both ways.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {lines.map(l => {
              const qty = qtys[l.index] ?? l.qty;
              const removed = qty === 0;
              return (
                <div key={l.index} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8125rem' }}>
                  <input type="hidden" name={`line__${l.index}__qty`} value={qty} />
                  <span style={{
                    flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: removed ? '#9ca3af' : '#111827',
                    textDecoration: removed ? 'line-through' : 'none',
                  }}>
                    {label(l)}
                  </span>
                  {removed && (
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#b91c1c', flexShrink: 0 }}>
                      will be removed
                    </span>
                  )}
                  <span style={{ color: '#6b7280', flexShrink: 0 }}>PKR {l.price.toLocaleString()}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <button
                      type="button"
                      aria-label={`Decrease quantity of ${l.name}`}
                      onClick={() => setQty(l.index, qty - 1)}
                      disabled={qty <= 0}
                      style={{ ...inp, width: 26, padding: '4px 0', cursor: qty <= 0 ? 'default' : 'pointer', color: '#374151' }}
                    >
                      −
                    </button>
                    <input
                      type="number" min={0} max={500} value={qty}
                      aria-label={`Quantity of ${l.name}`}
                      onChange={e => setQty(l.index, Number(e.target.value) || 0)}
                      style={{ ...inp, width: 56, padding: '4px 6px', textAlign: 'center' }}
                    />
                    <button
                      type="button"
                      aria-label={`Increase quantity of ${l.name}`}
                      onClick={() => setQty(l.index, qty + 1)}
                      style={{ ...inp, width: 26, padding: '4px 0', cursor: 'pointer', color: '#374151' }}
                    >
                      +
                    </button>
                  </span>
                </div>
              );
            })}

            {added.map(l => (
              <div key={addedKey(l)} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8125rem' }}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#111827' }}>
                  {l.label}
                  <span style={{ marginLeft: 8, fontSize: '0.6875rem', fontWeight: 700, color: '#15803d' }}>new</span>
                </span>
                <span style={{ color: '#6b7280', flexShrink: 0 }}>PKR {l.price.toLocaleString()}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <input
                    type="number" min={1} max={500} value={l.qty}
                    aria-label={`Quantity of ${l.label}`}
                    onChange={e => {
                      const qty = Math.max(1, Math.min(500, Number(e.target.value) || 1));
                      setAdded(prev => prev.map(x => (addedKey(x) === addedKey(l) ? { ...x, qty } : x)));
                    }}
                    style={{ ...inp, width: 56, padding: '4px 6px', textAlign: 'center' }}
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${l.label}`}
                    onClick={() => setAdded(prev => prev.filter(x => addedKey(x) !== addedKey(l)))}
                    style={{ border: 'none', background: 'none', color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </span>
              </div>
            ))}
          </div>

          <input
            type="hidden"
            name="added"
            value={JSON.stringify(added.map(l => ({ product_id: l.product_id, variant_id: l.variant_id, qty: l.qty })))}
          />

          {/* Add-line search: shade-aware, same picker shape as the manual
              order form (a product with shades can only be added AS a shade). */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <input
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                if (e.target.value.trim().length < 2) setMatches([]);
              }}
              placeholder="Add a product — search by name or brand…"
              aria-label="Search products to add"
              style={{ ...inp, width: '100%' }}
            />
            {matches.length > 0 && (
              <ul style={{
                position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, margin: '4px 0 0', padding: 4,
                listStyle: 'none', background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxHeight: 260, overflowY: 'auto',
              }}>
                {matches.map(p => {
                  const tracked = p.track_inventory ?? true;
                  if (p.variants.length > 0) {
                    return (
                      <li key={p.id}>
                        <div style={{ padding: '7px 10px 3px', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>
                          {p.brand ? `${p.brand} — ` : ''}{p.name}
                        </div>
                        {p.variants.map(v => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => addLine(p, v.id)}
                            style={{
                              display: 'flex', justifyContent: 'space-between', gap: 12, width: '100%',
                              padding: '7px 10px 7px 22px', border: 'none', background: 'none', cursor: 'pointer',
                              textAlign: 'left', fontSize: '0.8125rem', borderRadius: 6,
                            }}
                          >
                            <span>{v.label}</span>
                            <span style={{ color: '#6b7280', flexShrink: 0 }}>
                              PKR {v.price.toLocaleString()}
                              {tracked ? ` · ${v.stock ?? 0} in stock` : ''}
                            </span>
                          </button>
                        ))}
                      </li>
                    );
                  }
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addLine(p, null)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', gap: 12, width: '100%',
                          padding: '9px 10px', border: 'none', background: 'none', cursor: 'pointer',
                          textAlign: 'left', fontSize: '0.8125rem', borderRadius: 6,
                        }}
                      >
                        <span>{p.brand ? `${p.brand} — ` : ''}{p.name}</span>
                        <span style={{ color: '#6b7280', flexShrink: 0 }}>
                          PKR {p.price.toLocaleString()}
                          {tracked ? ` · ${p.stock ?? 0} in stock` : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={!changed || surviving === 0}
              style={{
                padding: '7px 16px', background: !changed || surviving === 0 ? '#e5a8c2' : '#C5286A',
                color: 'white', border: 'none', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
                cursor: !changed || surviving === 0 ? 'default' : 'pointer',
              }}
            >
              Save changes
            </button>
            <button type="button" onClick={() => setOpen(false)} style={{ padding: '7px 12px', background: 'transparent', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer' }}>
              Cancel
            </button>
            <span style={{ fontSize: '0.75rem', color: surviving === 0 ? '#b91c1c' : '#6b7280', marginLeft: 'auto' }}>
              {surviving === 0
                ? 'At least one item must remain. To call the order off, cancel it instead.'
                : <>New items subtotal: <strong style={{ color: '#111827' }}>PKR {newSubtotal.toLocaleString()}</strong></>}
            </span>
          </div>
        </form>
      )}
    </>
  );
}
