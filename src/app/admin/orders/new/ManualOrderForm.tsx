'use client';

// Manual order entry. Follows the ProductForm submission pattern (manual
// dispatch inside startTransition) so a rejected save returns an error
// banner WITHOUT React resetting the uncontrolled inputs — the operator's
// half-typed order survives validation round trips.

import { useActionState, useMemo, useRef, useState, startTransition } from 'react';
import Link from 'next/link';
import { createManualOrder, type ManualOrderState } from './actions';
import { EmptyState } from '@/components/admin/EmptyState';

export interface PickerProduct {
  id: string;
  name: string;
  /** Sourcing vendor (product form's "default supplier") — powers the
   *  fulfilment-vendor suggestion when added items agree on one. */
  vendor_id: string | null;
  brand: string | null;
  price: number;
  stock: number | null;
  track_inventory: boolean | null;
}

export interface PickerVendor {
  id: string;
  name: string;
  /** % of the sale price the store keeps on this vendor's items. */
  commission_pct: number | null;
}

export interface ShippingSuggestion {
  /** province → cheapest zone rate + free threshold (null = no zone). */
  byProvince: Record<string, { rate: number; threshold: number | null }>;
  defaultRate: number;
  defaultThreshold: number;
  freeEnabled: boolean;
}

interface Line { id: string; qty: number; price: number }

const PROVINCES = ['Punjab', 'Sindh', 'KPK', 'Balochistan', 'Islamabad', 'AJK', 'Gilgit-Baltistan'];

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: '0.875rem',
  border: '1px solid #d1d5db', borderRadius: 8, background: 'white',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 5,
};

export function ManualOrderForm({ products, vendors, shipping }: { products: PickerProduct[]; vendors: PickerVendor[]; shipping: ShippingSuggestion }) {
  const [state, dispatch, pending] = useActionState<ManualOrderState, FormData>(createManualOrder, { error: null });
  const formRef = useRef<HTMLFormElement>(null);

  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState('');
  const [province, setProvince] = useState('Punjab');
  const [shipOverridden, setShipOverridden] = useState(false);
  const [shipValue, setShipValue] = useState<number>(0);
  const [discount, setDiscount] = useState(0);
  const [email, setEmail] = useState('');
  const [vendorId, setVendorId] = useState('');

  const productById = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return products
      .filter(p => `${p.brand ?? ''} ${p.name}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, products]);

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);

  // Suggested shipping: zone rate for the province (or store default), free
  // at/above the threshold. Editable — the server trusts staff overrides.
  const suggestion = useMemo(() => {
    const zone = shipping.byProvince[province];
    const rate = zone?.rate ?? shipping.defaultRate;
    const threshold = zone?.threshold ?? shipping.defaultThreshold;
    const free = shipping.freeEnabled && subtotal >= threshold && subtotal > 0;
    return free ? 0 : rate;
  }, [province, subtotal, shipping]);

  const effectiveShipping = shipOverridden ? shipValue : suggestion;
  const total = Math.max(0, subtotal + effectiveShipping - discount);

  // Estimated vendor cost + margin preview — mirrors the commission math of
  // the shared engine (src/lib/order-costs.ts): unit cost = price × (1 −
  // pct/100). Preview only; the server recomputes authoritatively on create.
  const selectedVendor = vendors.find(v => v.id === vendorId) ?? null;
  const estVendorCost = selectedVendor && selectedVendor.commission_pct != null
    ? Math.round(lines.reduce((s, l) => s + l.price * l.qty * (1 - selectedVendor.commission_pct! / 100), 0) * 100) / 100
    : null;

  // Sourcing suggestion: when every added item that has a default supplier
  // points at the same one, offer it (mirrors the order page's suggestion).
  const suggestedVendor = useMemo(() => {
    if (vendorId) return null;
    const ids = new Set<string>();
    for (const l of lines) {
      const vid = productById.get(l.id)?.vendor_id;
      if (vid) ids.add(vid);
    }
    if (ids.size !== 1) return null;
    const [vid] = ids;
    return vendors.find(v => v.id === vid) ?? null;
  }, [vendorId, lines, productById, vendors]);

  const addLine = (id: string) => {
    const p = productById.get(id);
    if (!p) return;
    setLines(prev => {
      const existing = prev.find(l => l.id === id);
      if (existing) return prev.map(l => (l.id === id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { id, qty: 1, price: p.price }];
    });
    setSearch('');
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('items', JSON.stringify(lines));
    fd.set('shipping', String(effectiveShipping));
    fd.set('discount_amount', String(discount));
    startTransition(() => dispatch(fd));
  };

  return (
    <form ref={formRef} onSubmit={submit} style={{ maxWidth: 860 }}>
      {state.error && (
        <div role="alert" style={{
          background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.8125rem',
        }}>
          {state.error}
        </div>
      )}

      {/* ── Items ── */}
      <section style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 700 }}>Items</h2>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products by name or brand…"
            aria-label="Search products"
            style={inp}
          />
          {matches.length > 0 && (
            <ul style={{
              position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, margin: '4px 0 0', padding: 4,
              listStyle: 'none', background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxHeight: 280, overflowY: 'auto',
            }}>
              {matches.map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => addLine(p.id)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', gap: 12, width: '100%',
                      padding: '9px 10px', border: 'none', background: 'none', cursor: 'pointer',
                      textAlign: 'left', fontSize: '0.8125rem', borderRadius: 6,
                    }}
                  >
                    <span>{p.brand ? `${p.brand} — ` : ''}{p.name}</span>
                    <span style={{ color: '#6b7280', flexShrink: 0 }}>
                      PKR {p.price.toLocaleString()}
                      {(p.track_inventory ?? true) ? ` · ${p.stock ?? 0} in stock` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lines.length === 0 ? (
          <EmptyState compact icon="layers" title="No items yet">
            Search above to add the products the customer asked for.
          </EmptyState>
        ) : (
          <div className="adm-table-scroll" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                  <th style={{ padding: '6px 8px 6px 0', fontWeight: 600 }}>Product</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, width: 90 }}>Qty</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, width: 130 }}>Unit price</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right', width: 110 }}>Line total</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {lines.map(l => {
                  const p = productById.get(l.id);
                  if (!p) return null;
                  const short = (p.track_inventory ?? true) && (p.stock ?? 0) < l.qty;
                  return (
                    <tr key={l.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 8px 8px 0' }}>
                        {p.brand ? `${p.brand} — ` : ''}{p.name}
                        {short && (
                          <span style={{ display: 'block', color: '#b91c1c', fontSize: '0.75rem' }}>
                            Only {p.stock ?? 0} in stock
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 8 }}>
                        <input
                          type="number" min={1} max={500} value={l.qty}
                          aria-label={`Quantity of ${p.name}`}
                          onChange={e => setLines(prev => prev.map(x => x.id === l.id ? { ...x, qty: Math.max(1, Math.min(500, Number(e.target.value) || 1)) } : x))}
                          style={{ ...inp, width: 72, padding: '6px 8px' }}
                        />
                      </td>
                      <td style={{ padding: 8 }}>
                        <input
                          type="number" min={0} step="1" value={l.price}
                          aria-label={`Unit price of ${p.name}`}
                          onChange={e => setLines(prev => prev.map(x => x.id === l.id ? { ...x, price: Math.max(0, Number(e.target.value) || 0) } : x))}
                          style={{ ...inp, width: 110, padding: '6px 8px' }}
                        />
                      </td>
                      <td style={{ padding: 8, textAlign: 'right' }} className="tabular-nums">
                        PKR {(l.price * l.qty).toLocaleString()}
                      </td>
                      <td style={{ padding: 8, textAlign: 'right' }}>
                        <button
                          type="button"
                          aria-label={`Remove ${p.name}`}
                          onClick={() => setLines(prev => prev.filter(x => x.id !== l.id))}
                          style={{ border: 'none', background: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Customer ── */}
      <section style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 700 }}>Customer & delivery</h2>
        <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl} htmlFor="mo-first">First name *</label>
            <input id="mo-first" name="first_name" required style={inp} />
          </div>
          <div>
            <label style={lbl} htmlFor="mo-last">Last name</label>
            <input id="mo-last" name="last_name" style={inp} />
          </div>
          <div>
            <label style={lbl} htmlFor="mo-phone">Phone *</label>
            <input id="mo-phone" name="phone" required inputMode="tel" placeholder="03XXXXXXXXX" style={inp} />
          </div>
          <div>
            <label style={lbl} htmlFor="mo-email">Email (optional)</label>
            <input id="mo-email" name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl} htmlFor="mo-address">Address *</label>
            <input id="mo-address" name="address" required style={inp} />
          </div>
          <div>
            <label style={lbl} htmlFor="mo-city">City *</label>
            <input id="mo-city" name="city" required style={inp} />
          </div>
          <div>
            <label style={lbl} htmlFor="mo-province">Province</label>
            <select id="mo-province" name="province" value={province} onChange={e => { setProvince(e.target.value); setShipOverridden(false); }} style={inp}>
              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* ── Payment & totals ── */}
      <section style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 700 }}>Payment & totals</h2>
        <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl} htmlFor="mo-pay">Payment method</label>
            <select id="mo-pay" name="pay_method" defaultValue="cod" style={inp}>
              <option value="cod">Cash on Delivery</option>
              <option value="bank">Bank Transfer</option>
            </select>
          </div>
          <div>
            <label style={lbl} htmlFor="mo-status">Initial status</label>
            <select id="mo-status" name="status" defaultValue="pending" style={inp}>
              <option value="pending">Pending (needs confirmation)</option>
              <option value="processing">Processing (already confirmed)</option>
            </select>
          </div>
          <div>
            <label style={lbl} htmlFor="mo-ship">
              Shipping (suggested: PKR {suggestion.toLocaleString()})
            </label>
            <input
              id="mo-ship" type="number" min={0} step="1"
              value={effectiveShipping}
              onChange={e => { setShipOverridden(true); setShipValue(Math.max(0, Number(e.target.value) || 0)); }}
              style={inp}
            />
          </div>
          <div>
            <label style={lbl} htmlFor="mo-discount">Discount (PKR)</label>
            <input
              id="mo-discount" type="number" min={0} step="1" value={discount}
              onChange={e => setDiscount(Math.max(0, Number(e.target.value) || 0))}
              style={inp}
            />
          </div>
          {vendors.length > 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl} htmlFor="mo-vendor">Fulfilled by vendor (optional)</label>
              <select
                id="mo-vendor" name="vendor_id" value={vendorId}
                onChange={e => setVendorId(e.target.value)}
                style={inp}
              >
                <option value="">Own stock — no vendor</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}{v.commission_pct != null ? ` — ${Number(v.commission_pct)}% margin` : ''}
                  </option>
                ))}
              </select>
              <p style={{ margin: '5px 0 0', fontSize: '0.6875rem', color: '#6b7280' }}>
                Picking a vendor records the order&apos;s goods cost automatically from
                the vendor&apos;s rate and creates the settlement (payout) row.
              </p>
              {suggestedVendor && (
                <p style={{ margin: '6px 0 0', fontSize: '0.6875rem', color: '#92400e' }}>
                  {suggestedVendor.name} is the default supplier for the added item(s) —{' '}
                  <button
                    type="button"
                    onClick={() => setVendorId(suggestedVendor.id)}
                    style={{ background: 'none', border: 'none', padding: 0, color: '#C5286A', fontWeight: 600, cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline' }}
                  >
                    use them
                  </button>.
                </p>
              )}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, fontSize: '0.875rem', display: 'grid', gap: 4, justifyContent: 'end' }}>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'space-between' }}>
            <span style={{ color: '#6b7280' }}>Subtotal</span>
            <span className="tabular-nums">PKR {subtotal.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'space-between' }}>
            <span style={{ color: '#6b7280' }}>Shipping</span>
            <span className="tabular-nums">{effectiveShipping === 0 ? 'FREE' : `PKR ${effectiveShipping.toLocaleString()}`}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: 'flex', gap: 24, justifyContent: 'space-between', color: '#15803d' }}>
              <span>Discount</span>
              <span className="tabular-nums">− PKR {discount.toLocaleString()}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 24, justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem' }}>
            <span>Total</span>
            <span className="tabular-nums">PKR {total.toLocaleString()}</span>
          </div>
          {selectedVendor && estVendorCost != null && subtotal > 0 && (
            <div style={{
              display: 'flex', gap: 24, justifyContent: 'space-between',
              fontSize: '0.75rem', color: '#6b7280', borderTop: '1px dashed #e5e7eb',
              paddingTop: 6, marginTop: 2,
            }}>
              <span>Est. vendor cost ({selectedVendor.name} @ {Number(selectedVendor.commission_pct)}%)</span>
              <span className="tabular-nums">
                PKR {estVendorCost.toLocaleString()} · margin PKR {(Math.round((subtotal - estVendorCost) * 100) / 100).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </section>

      {email.trim() !== '' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: '0.8125rem', color: '#374151' }}>
          <input type="checkbox" name="send_confirmation" value="true" defaultChecked />
          Email the order confirmation to {email.trim()}
        </label>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="submit" className="adm-btn-primary" disabled={pending || lines.length === 0} style={{
          padding: '10px 20px', borderRadius: 8, border: 'none', cursor: pending ? 'wait' : 'pointer',
          background: '#111827', color: 'white', fontWeight: 600, fontSize: '0.875rem',
          opacity: pending || lines.length === 0 ? 0.6 : 1,
        }}>
          {pending ? 'Creating…' : 'Create order'}
        </button>
        <Link href="/admin/orders" style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Cancel</Link>
      </div>
    </form>
  );
}
