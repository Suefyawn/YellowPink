'use client';

import { useState, useEffect, useActionState } from 'react';
import { updateCoupon } from '@/app/admin/coupon-actions';
import { ProductMultiSelect, type SelectableProduct } from '@/components/admin/ProductMultiSelect';
import { WELCOME_CODE } from '@/lib/commerce';
import type { Coupon } from '@/types';

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4,
};
const inp: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none', boxSizing: 'border-box',
};

export function CouponEditModal({ coupon, products = [] }: { coupon: Coupon; products?: SelectableProduct[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateCoupon, null);
  // The welcome code is advertised by name in the popup + welcome email, so
  // renaming it is blocked server-side; grey the field out to say so upfront.
  const isWelcome = coupon.code.toUpperCase() === WELCOME_CODE;
  // Method is fixed at creation (the server never updates trigger_kind);
  // automatics edit their customer-facing Title instead of the code.
  const isAutomatic = coupon.trigger_kind === 'automatic';
  // Buy X get Y: the config is editable, the kind isn't (a coupon never
  // switches between BXGY and the value maths after creation — like Method).
  const isBxgy = coupon.bxgy != null;
  // Controlled so the Value field can switch off for free-shipping coupons
  // (they carry no monetary value; the action stores value = 0).
  const [type, setType] = useState<'percent' | 'fixed' | 'free_shipping'>(
    coupon.discount_type === 'free_shipping' || coupon.free_shipping ? 'free_shipping' : coupon.type,
  );
  const isFreeShipping = type === 'free_shipping';
  // BXGY "Customer gets" value: Free (pct_off 100) or a percentage.
  const [bxgyValueKind, setBxgyValueKind] = useState<'free' | 'percent'>(
    (coupon.bxgy?.pct_off ?? 100) >= 100 ? 'free' : 'percent',
  );

  // Close the modal once the server action reports a successful save.
  // setState-in-effect is intentional: the trigger is the action result.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state?.ok) setOpen(false);
  }, [state]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb',
          background: 'white', color: '#374151', fontSize: '0.75rem', fontWeight: 600,
          cursor: 'pointer', minHeight: 30,
        }}
      >
        Edit
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)',
            zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '8vh 16px', overflowY: 'auto',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Edit coupon ${coupon.code}`}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 12, padding: '24px',
              width: '100%', maxWidth: 440, boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
              Edit coupon
            </h3>
            <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input type="hidden" name="id" value={coupon.id} />
              <div>
                <label style={lbl}>Method</label>
                {/* Read-only: switching a discount between code and automatic
                    after creation is out of scope (the server ignores any
                    attempt to change trigger_kind). */}
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151' }}>
                  {isAutomatic ? 'Automatic — applies by itself to qualifying carts' : 'Discount code — the shopper types it'}
                </p>
              </div>
              {isBxgy && (
                <div>
                  <label style={lbl}>Discount type</label>
                  {/* Read-only, like Method: a coupon never switches between
                      Buy X get Y and the amount-off maths after creation. */}
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151' }}>
                    Buy X get Y — the quantities, products and value below are editable; the type itself is fixed.
                  </p>
                </div>
              )}
              {isAutomatic ? (
                <div>
                  <label style={lbl}>Title</label>
                  <input
                    name="title" required maxLength={120}
                    defaultValue={coupon.title ?? ''}
                    placeholder="e.g. Azadi Sale: 14% off everything"
                    style={inp}
                  />
                  <p style={{ margin: '4px 0 0', fontSize: '0.6875rem', color: '#9ca3af' }}>
                    Shown on the cart and checkout discount line. Code{' '}
                    <span style={{ fontFamily: 'monospace' }}>{coupon.code}</span> is internal, never shown to shoppers.
                  </p>
                </div>
              ) : (
                <div>
                  <label style={lbl}>Code</label>
                  <input
                    name="code" required defaultValue={coupon.code}
                    readOnly={isWelcome}
                    title={isWelcome ? 'Advertised by the newsletter popup and welcome email — the code itself can’t change.' : undefined}
                    style={{
                      ...inp, textTransform: 'uppercase', fontFamily: 'monospace',
                      ...(isWelcome ? { background: '#f9fafb', color: '#6b7280' } : {}),
                    }}
                  />
                  {isWelcome && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.6875rem', color: '#9ca3af' }}>
                      Advertised by the newsletter popup + welcome email; values are editable, the code isn&apos;t.
                    </p>
                  )}
                </div>
              )}
              {isBxgy ? (
                <>
                  {/* Buy X get Y editor: the config is editable, the kind is
                      fixed at creation (like Method — the server keeps a BXGY
                      coupon BXGY no matter what the form submits). */}
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '0.8125rem', fontWeight: 700, color: '#111827' }}>Customer buys</h4>
                    <div style={{ marginBottom: 10 }}>
                      <label style={lbl}>Quantity</label>
                      <input name="bxgy_buy_qty" type="number" min={1} required defaultValue={coupon.bxgy!.buy_qty} style={{ ...inp, width: 90 }} />
                    </div>
                    <label style={lbl}>Any items from</label>
                    <ProductMultiSelect
                      name="bxgy_buy_product_ids"
                      products={products}
                      initialIds={coupon.bxgy!.buy_product_ids}
                      placeholder="Search products the customer must buy…"
                    />
                  </div>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '0.8125rem', fontWeight: 700, color: '#111827' }}>Customer gets</h4>
                    <div style={{ marginBottom: 10 }}>
                      <label style={lbl}>Quantity</label>
                      <input name="bxgy_get_qty" type="number" min={1} required defaultValue={coupon.bxgy!.get_qty} style={{ ...inp, width: 90 }} />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={lbl}>Any items from</label>
                      <ProductMultiSelect
                        name="bxgy_get_product_ids"
                        products={products}
                        initialIds={coupon.bxgy!.get_product_ids}
                        placeholder="Search products the discount applies to…"
                      />
                      <p style={{ margin: '4px 0 0', fontSize: '0.6875rem', color: '#9ca3af' }}>
                        The cheapest qualifying items in the cart get the discount.
                      </p>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={lbl}>Discount value</label>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: '#374151', cursor: 'pointer' }}>
                          <input
                            type="radio" name="bxgy_value_kind" value="free"
                            checked={bxgyValueKind === 'free'}
                            onChange={() => setBxgyValueKind('free')}
                          />
                          Free
                        </label>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: '#374151', cursor: 'pointer' }}>
                          <input
                            type="radio" name="bxgy_value_kind" value="percent"
                            checked={bxgyValueKind === 'percent'}
                            onChange={() => setBxgyValueKind('percent')}
                          />
                          Percentage
                        </label>
                        {bxgyValueKind === 'percent' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <input
                              name="bxgy_pct_off" type="number" min={1} max={100} required
                              defaultValue={coupon.bxgy!.pct_off < 100 ? coupon.bxgy!.pct_off : ''}
                              placeholder="50"
                              style={{ ...inp, width: 80 }}
                            />
                            <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>% off</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Maximum uses per order</label>
                      <input name="bxgy_max_per_order" type="number" min={1} required defaultValue={coupon.bxgy!.max_per_order} style={{ ...inp, width: 90 }} />
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Type</label>
                    <select
                      name="type" value={type}
                      onChange={e => setType(e.target.value as 'percent' | 'fixed' | 'free_shipping')}
                      style={inp}
                    >
                      <option value="percent">Percent %</option>
                      <option value="fixed">Fixed PKR</option>
                      <option value="free_shipping">Free shipping</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Value</label>
                    <input
                      name="value" type="number" min={1}
                      required={!isFreeShipping} disabled={isFreeShipping}
                      defaultValue={coupon.value || ''}
                      placeholder={isFreeShipping ? '—' : undefined}
                      style={{ ...inp, ...(isFreeShipping ? { background: '#f9fafb', color: '#9ca3af' } : {}) }}
                    />
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Min order (PKR)</label>
                  <input name="min_order" type="number" min={0} defaultValue={coupon.min_order ?? 0} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Max uses</label>
                  <input
                    name="max_uses" type="number" min={1}
                    defaultValue={coupon.max_uses ?? ''} placeholder="Unlimited" style={inp}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Starts</label>
                  <input
                    name="starts_at" type="date"
                    defaultValue={coupon.starts_at ? coupon.starts_at.slice(0, 10) : ''}
                    style={inp}
                  />
                  <p style={{ margin: '4px 0 0', fontSize: '0.6875rem', color: '#9ca3af' }}>Blank = works right away. A future day shows as Scheduled.</p>
                </div>
                <div>
                  <label style={lbl}>Expires</label>
                  <input
                    name="expires_at" type="date"
                    defaultValue={coupon.expires_at ? coupon.expires_at.slice(0, 10) : ''}
                    style={inp}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Uses per customer</label>
                  <input
                    name="usage_limit_per_user" type="number" min={1}
                    defaultValue={coupon.usage_limit_per_user ?? ''} placeholder="Unlimited" style={inp}
                  />
                </div>
                <div>
                  <label style={lbl}>Max order (PKR)</label>
                  <input
                    name="max_order" type="number" min={1}
                    defaultValue={coupon.max_order ?? ''} placeholder="No cap" style={inp}
                  />
                </div>
              </div>
              <div>
                <label style={lbl}>Restrict to emails</label>
                <input
                  name="email_restrictions"
                  defaultValue={(coupon.email_restrictions ?? []).join(', ')}
                  placeholder="someone@mail.com, *@company.pk"
                  style={inp}
                />
                <p style={{ margin: '4px 0 0', fontSize: '0.6875rem', color: '#9ca3af' }}>
                  Comma-separated. <code>*@domain.pk</code> allows a whole domain. Empty = everyone.
                </p>
              </div>
              {products.length > 0 && (
                <>
                  <div>
                    <label style={lbl}>Only applies to these products</label>
                    <ProductMultiSelect
                      name="product_ids"
                      products={products}
                      initialIds={coupon.product_ids ?? []}
                      placeholder="Search to limit the coupon to specific products…"
                    />
                  </div>
                  <div>
                    <label style={lbl}>Never applies to these products</label>
                    <ProductMultiSelect
                      name="excluded_product_ids"
                      products={products}
                      initialIds={coupon.excluded_product_ids ?? []}
                      placeholder="Search to exclude products…"
                    />
                  </div>
                </>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#374151', cursor: 'pointer' }}>
                {/* Marker so the server can tell "unchecked" from "form never
                    rendered the field" (the create form doesn't). */}
                <input type="hidden" name="exclude_sale_items_present" value="1" />
                <input type="checkbox" name="exclude_sale_items" value="true" defaultChecked={Boolean(coupon.exclude_sale_items)} />
                Don&apos;t apply to sale items (items already below their compare-at price)
              </label>
              <div>
                <label style={lbl}>Internal note</label>
                <input
                  name="description"
                  defaultValue={coupon.description ?? ''}
                  placeholder="e.g. Eid campaign, influencer batch 3"
                  style={inp}
                />
              </div>

              {state?.error && (
                <p role="alert" style={{ margin: 0, fontSize: '0.8125rem', color: '#dc2626' }}>
                  {state.error}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 7, border: '1px solid #e5e7eb',
                    background: 'white', color: '#374151', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  style={{
                    padding: '8px 20px', borderRadius: 7, border: 'none',
                    background: pending ? '#9ca3af' : '#C5286A', color: 'white',
                    fontSize: '0.875rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {pending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
