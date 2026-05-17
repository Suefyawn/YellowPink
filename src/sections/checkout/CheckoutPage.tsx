'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { getBrowserClient } from '@/lib/supabase-browser';
import { notifyNewOrder, calculateShipping, checkoutRateGate } from '@/app/checkout/actions';
import { captureAbandonedCart } from '@/app/checkout/abandoned-cart-actions';
import { validateGiftCardCode, validateReferralCode } from '@/app/checkout/rewards-actions';
import { postOrderDestination } from '@/lib/checkout-routing';
import type { Coupon, PayMethod, LoyaltyAccount } from '@/types';

const PROVINCES = ['Punjab', 'Sindh', 'KPK', 'Balochistan', 'Islamabad', 'AJK', 'Gilgit-Baltistan'];

const PAY_METHODS: ReadonlyArray<[PayMethod, string, string]> = [
  ['cod',       'Cash on Delivery (COD)', 'Pay when your order arrives'],
  ['jazzcash',  'JazzCash',               'Pay with JazzCash mobile wallet'],
  ['easypaisa', 'Easypaisa',              'Pay with Easypaisa mobile wallet'],
  ['card',      'Credit / Debit Card',    'Visa, Mastercard via JazzCash'],
  ['bank',      'Bank Transfer',          'Direct bank deposit'],
];

function makeOrderNumber() {
  // Add a 2-byte random suffix so two near-simultaneous clicks can't collide.
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return 'YP-' + Date.now().toString(36).slice(-5).toUpperCase() + rand;
}

export function CheckoutPage() {
  const { cartItems, clearCart, appliedCoupon: cartCoupon, setAppliedCoupon } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  const [payMethod, setPayMethod] = useState<PayMethod>('cod');
  const [formData, setFormData] = useState({ email: '', firstName: '', lastName: '', phone: '', address: '', city: '', province: '', zip: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [couponCode, setCouponCode] = useState(cartCoupon?.code ?? '');
  const [coupon, setCoupon] = useState<Coupon | null>(cartCoupon);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [shippingInfo, setShippingInfo] = useState<{ rate: number; free: boolean; label: string }>({ rate: 200, free: false, label: 'Standard' });

  // ─── Rewards: gift card + loyalty + referral ────────────────────────────
  const [giftCardCode, setGiftCardCode]     = useState('');
  const [giftCardError, setGiftCardError]   = useState('');
  const [giftCard, setGiftCard]             = useState<{ code: string; balance: number } | null>(null);
  const [refCodeInput, setRefCodeInput]     = useState('');
  const [refCodeError, setRefCodeError]     = useState('');
  const [refCode, setRefCode]               = useState<{ code: string; pct: number } | null>(null);
  const [loyalty, setLoyalty]               = useState<LoyaltyAccount | null>(null);
  const [pointsRedeemInput, setPointsRedeemInput] = useState<number | ''>('');
  const [pointsRedeem, setPointsRedeem]     = useState(0);

  // Pre-fill referral code from ?ref= or localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const fromUrl = sp.get('ref');
    const stored  = window.localStorage.getItem('yp_ref');
    const code    = fromUrl ?? stored ?? '';
    if (fromUrl) window.localStorage.setItem('yp_ref', fromUrl);
    if (code) setRefCodeInput(code);
  }, []);

  // Pull loyalty balance for signed-in users.
  useEffect(() => {
    if (!user) { setLoyalty(null); return; }
    const sb = getBrowserClient();
    sb.from('loyalty_accounts').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setLoyalty(data as LoyaltyAccount | null));
  }, [user]);

  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const couponDiscount = coupon
    ? coupon.type === 'percent'
      ? Math.round(subtotal * coupon.value / 100)
      : coupon.value
    : 0;
  const refDiscount = refCode ? Math.round(subtotal * refCode.pct / 100) : 0;
  const discount = couponDiscount + refDiscount;
  const lineTotal = Math.max(0, subtotal - discount);
  const shipping = shippingInfo.rate;
  const beforeRewards = lineTotal + shipping;

  // Points: cap at the remaining payable amount AFTER gift card.
  const giftCardCovers = giftCard ? Math.min(giftCard.balance, beforeRewards) : 0;
  const remainingAfterGc = Math.max(0, beforeRewards - giftCardCovers);
  const pointsCovers     = Math.min(pointsRedeem, remainingAfterGc);
  const total            = Math.max(0, remainingAfterGc - pointsCovers);

  // Recompute shipping whenever subtotal or province changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (lineTotal === 0) return;
      const res = await calculateShipping({ province: formData.province || undefined, subtotal: lineTotal });
      if (!cancelled) setShippingInfo(res);
    })();
    return () => { cancelled = true; };
  }, [lineTotal, formData.province]);

  // Capture abandoned-cart snapshot when the user supplies an email AND the
  // cart is non-empty. Debounced 1.2 s so we don't fire per keystroke.
  useEffect(() => {
    if (cartItems.length === 0) return;
    const email = formData.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    const t = setTimeout(() => {
      void captureAbandonedCart({
        email,
        items: cartItems,
        subtotal,
        user_id: user?.id ?? null,
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [formData.email, cartItems, subtotal, user?.id]);

  const update = (key: string, val: string) => {
    setFormData(p => ({ ...p, [key]: val }));
    if (errors[key]) setErrors(p => { const n = { ...p }; delete n[key]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.firstName.trim()) e.firstName = 'Required';
    if (!formData.lastName.trim()) e.lastName = 'Required';
    const phone = formData.phone.trim().replace(/\s/g, '');
    if (!phone) {
      e.phone = 'Required';
    } else if (!/^(\+92|0092|0)?3\d{9}$/.test(phone)) {
      e.phone = 'Enter a valid Pakistani mobile number (e.g. 03001234567)';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      e.email = 'Enter a valid email address';
    }
    if (!formData.address.trim()) e.address = 'Required';
    if (!formData.city.trim()) e.city = 'Required';
    // Card/JazzCash/Easypaisa require an email so we can send payment confirmations.
    if ((payMethod === 'jazzcash' || payMethod === 'easypaisa' || payMethod === 'card') && !formData.email) {
      e.email = 'Required for online payment confirmation';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError('');
    setCouponLoading(true);
    const sb = getBrowserClient();
    const { data } = await sb.from('coupons').select('*').eq('code', couponCode.trim().toUpperCase()).eq('active', true).single();
    setCouponLoading(false);
    if (!data) { setCouponError('Invalid or expired coupon code'); return; }
    const c = data as Coupon;
    if (c.expires_at && new Date(c.expires_at) < new Date()) { setCouponError('This coupon has expired'); return; }
    if (c.max_uses !== null && c.used_count >= c.max_uses) { setCouponError('This coupon has reached its usage limit'); return; }
    if (subtotal < c.min_order) { setCouponError(`Minimum order of PKR ${c.min_order.toLocaleString()} required`); return; }
    setCoupon(c);
    setAppliedCoupon(c);
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const rate = await checkoutRateGate();
    if (!rate.ok) {
      setSubmitError('Too many checkout attempts. Please wait a minute and try again.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const orderNumber = makeOrderNumber();
      const sb = getBrowserClient();
      const { data, error } = await sb.rpc('place_order' as never, {
        order_data: {
          order_number: orderNumber,
          email: formData.email || '',
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone.trim(),
          address: formData.address,
          city: formData.city,
          province: formData.province || '',
          zip: formData.zip || '',
          pay_method: payMethod,
          subtotal,
          shipping,
          total: beforeRewards,                  // pre-rewards order total — gift card / points decrement separately
          items: cartItems,
          status: 'pending',
          user_id: user?.id || '',
          coupon_code: coupon?.code || '',
          discount_amount: discount,
        },
        gift_card_code:   giftCard?.code ?? null,
        points_redeem:    pointsCovers > 0 ? pointsCovers : null,
        referred_by_code: refCode?.code ?? null,
      } as never);
      if (error) throw new Error(error.message);
      void data;

      const dest = postOrderDestination(payMethod, orderNumber);

      if (dest.kind === 'gateway_post') {
        // Build a form and submit to the gateway initiator route.
        // The route handler returns an HTML auto-submit form that POSTs to the
        // real gateway. We POST as a form so the response can be a top-level
        // navigation (the browser shows the gateway's hosted page).
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = dest.url;
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'order_number';
        input.value = orderNumber;
        form.appendChild(input);
        document.body.appendChild(form);
        clearCart();
        form.submit();
        return;
      }

      // COD / bank / gift_card path — fire customer + owner emails, then thank-you.
      void notifyNewOrder({
        order_number: orderNumber,
        email: formData.email || undefined,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone.trim(),
        city: formData.city,
        province: formData.province || undefined,
        total,
        items: cartItems.map(i => ({
          name: i.name, qty: i.qty, price: i.price, brand: i.brand, variant: i.variant,
        })),
        pay_method: payMethod,
      });
      clearCart();
      router.push(dest.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setSubmitError(msg);
      setSubmitting(false);
    }
  };

  const inputStyle = (key: string): React.CSSProperties => ({
    width: '100%', padding: '10px 12px',
    border: `1px solid ${errors[key] ? 'var(--error)' : 'var(--line)'}`,
    borderRadius: 'var(--radius-card)', fontFamily: 'var(--font-ui)',
    fontSize: '0.875rem', color: 'var(--ink-900)', background: 'var(--paper)',
    outline: 'none',
  });
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: 6 };

  return (
    <div>
      <section style={{ padding: '48px 0 0', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Checkout</Overline>
          <h1 className="display-l" style={{ fontSize: '2rem', marginBottom: 32 }}>Complete Your Order</h1>
        </div>
      </section>

      <section style={{ padding: '40px 0 var(--section-gap)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 48 }} className="checkout-grid">
            <div>
              <Overline style={{ display: 'block', marginBottom: 16 }}>Contact</Overline>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Email {(payMethod === 'jazzcash' || payMethod === 'easypaisa' || payMethod === 'card') ? '*' : '(optional)'}</label>
                <input type="email" value={formData.email} onChange={e => update('email', e.target.value)} placeholder="For order updates and payment receipts" style={inputStyle('email')} />
                {errors.email && <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.email}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }} className="checkout-name-grid">
                <div>
                  <label style={labelStyle}>Phone *</label>
                  <input type="tel" value={formData.phone} onChange={e => update('phone', e.target.value)} placeholder="+92 300 1234567" style={inputStyle('phone')} />
                  {errors.phone && <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.phone}</span>}
                </div>
              </div>

              <hr className="hairline" style={{ margin: '32px 0' }} />
              <Overline style={{ display: 'block', marginBottom: 16 }}>Shipping Address</Overline>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>First Name *</label>
                  <input value={formData.firstName} onChange={e => update('firstName', e.target.value)} style={inputStyle('firstName')} />
                  {errors.firstName && <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.firstName}</span>}
                </div>
                <div>
                  <label style={labelStyle}>Last Name *</label>
                  <input value={formData.lastName} onChange={e => update('lastName', e.target.value)} style={inputStyle('lastName')} />
                  {errors.lastName && <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.lastName}</span>}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Address *</label>
                <input value={formData.address} onChange={e => update('address', e.target.value)} placeholder="House/flat, street, area" style={inputStyle('address')} />
                {errors.address && <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.address}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }} className="addr-grid-3">
                <div>
                  <label style={labelStyle}>City *</label>
                  <input value={formData.city} onChange={e => update('city', e.target.value)} style={inputStyle('city')} />
                  {errors.city && <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.city}</span>}
                </div>
                <div>
                  <label style={labelStyle}>Province</label>
                  <select value={formData.province} onChange={e => update('province', e.target.value)} style={{ ...inputStyle('province'), cursor: 'pointer' }}>
                    <option value="">Select</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Postal Code</label>
                  <input value={formData.zip} onChange={e => update('zip', e.target.value)} style={inputStyle('zip')} />
                </div>
              </div>

              <hr className="hairline" style={{ margin: '32px 0' }} />
              <Overline style={{ display: 'block', marginBottom: 16 }}>Payment Method</Overline>
              {PAY_METHODS.map(([key, label, desc]) => (
                <label key={key} onClick={() => setPayMethod(key)} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px',
                  border: '1px solid ' + (payMethod === key ? 'var(--ink-900)' : 'var(--line)'),
                  borderRadius: 'var(--radius-card)', cursor: 'pointer',
                  marginBottom: -1, background: payMethod === key ? 'var(--paper2)' : 'transparent',
                  transition: 'all 150ms',
                }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1, border: payMethod === key ? '5px solid var(--ink-900)' : '2px solid var(--line)', transition: 'border 150ms' }} />
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{label}</div>
                    <div className="small-text">{desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ background: 'var(--paper2)', borderRadius: 'var(--radius-card)', padding: 28, border: '1px solid var(--line)', alignSelf: 'start', position: 'sticky', top: 100 }}>
              <Overline style={{ display: 'block', marginBottom: 16, color: 'var(--ink-500)' }}>Your Order</Overline>
              {cartItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-card)', flexShrink: 0, overflow: 'hidden', background: 'var(--paper2)', position: 'relative' }}>
                    <ProductImage src={item.image_url} alt={item.name} />
                    <span style={{ position: 'absolute', top: -6, right: -6, background: 'var(--ink-900)', color: 'var(--paper)', width: 18, height: 18, borderRadius: '50%', fontSize: '0.625rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.qty}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{item.name}</div>
                    {item.variant && <div className="small-text" style={{ fontSize: '0.6875rem' }}>{item.variant}</div>}
                  </div>
                  <span className="tabular-nums" style={{ fontSize: '0.8125rem', fontWeight: 500, flexShrink: 0 }}>PKR {(item.price * item.qty).toLocaleString()}</span>
                </div>
              ))}
              <hr className="hairline" style={{ margin: '16px 0' }} />

              {!coupon ? (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={couponCode}
                      onChange={e => { setCouponCode(e.target.value); setCouponError(''); }}
                      placeholder="Coupon code"
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6, fontSize: '0.8125rem', outline: 'none', background: 'white', fontFamily: 'monospace', textTransform: 'uppercase' }}
                    />
                    <button onClick={applyCoupon} disabled={couponLoading} style={{
                      padding: '8px 14px', background: '#111827', color: 'white', border: 'none',
                      borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: couponLoading ? 'not-allowed' : 'pointer',
                    }}>
                      {couponLoading ? '…' : 'Apply'}
                    </button>
                  </div>
                  {couponError && <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--error)' }}>{couponError}</p>}
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '8px 10px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#15803d', fontWeight: 600 }}>
                    ✓ {coupon.code} {coupon.type === 'percent' ? `(${coupon.value}% off)` : `(PKR ${coupon.value} off)`}
                  </span>
                  <button onClick={() => { setCoupon(null); setCouponCode(''); }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                </div>
              )}

              {/* Gift card */}
              {!giftCard ? (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={giftCardCode}
                      onChange={e => { setGiftCardCode(e.target.value.toUpperCase()); setGiftCardError(''); }}
                      placeholder="Gift card"
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6, fontSize: '0.8125rem', outline: 'none', background: 'white', fontFamily: 'monospace' }}
                    />
                    <button onClick={async () => {
                      const r = await validateGiftCardCode(giftCardCode);
                      if (!r.valid) { setGiftCardError('Invalid or empty gift card'); return; }
                      setGiftCard({ code: giftCardCode.trim().toUpperCase(), balance: r.balance });
                    }} style={{ padding: '8px 12px', background: 'var(--ink-900)', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Apply</button>
                  </div>
                  {giftCardError && <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--error)' }}>{giftCardError}</p>}
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '8px 10px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#15803d', fontWeight: 600 }}>🎁 {giftCard.code} (PKR {giftCard.balance.toLocaleString()} balance)</span>
                  <button onClick={() => { setGiftCard(null); setGiftCardCode(''); }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                </div>
              )}

              {/* Referral code */}
              {!refCode ? (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={refCodeInput}
                      onChange={e => { setRefCodeInput(e.target.value.toUpperCase()); setRefCodeError(''); }}
                      placeholder="Referral code (optional)"
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6, fontSize: '0.8125rem', outline: 'none', background: 'white', fontFamily: 'monospace' }}
                    />
                    <button onClick={async () => {
                      const r = await validateReferralCode(refCodeInput);
                      if (!r.valid) { setRefCodeError('Not a valid referral code'); return; }
                      setRefCode({ code: refCodeInput.trim().toUpperCase(), pct: r.discount_pct });
                    }} style={{ padding: '8px 12px', background: 'var(--ink-900)', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Apply</button>
                  </div>
                  {refCodeError && <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--error)' }}>{refCodeError}</p>}
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '8px 10px', background: '#fdf4ff', borderRadius: 6, border: '1px solid #f5d0fe' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#a21caf', fontWeight: 600 }}>👥 {refCode.code} (−{refCode.pct}%)</span>
                  <button onClick={() => { setRefCode(null); setRefCodeInput(''); }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                </div>
              )}

              {/* Loyalty points redemption (only when signed in with balance) */}
              {loyalty && loyalty.points_balance > 0 && (
                <div style={{ marginBottom: 12, padding: '8px 10px', background: '#fffbeb', borderRadius: 6, border: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>★ {loyalty.points_balance.toLocaleString()} points available</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number" min={0} max={Math.min(loyalty.points_balance, remainingAfterGc)}
                        value={pointsRedeemInput}
                        onChange={e => {
                          const n = e.target.value === '' ? '' : Math.max(0, Math.min(loyalty.points_balance, Number(e.target.value)));
                          setPointsRedeemInput(n);
                          setPointsRedeem(typeof n === 'number' ? n : 0);
                        }}
                        placeholder="0"
                        style={{ width: 70, padding: '4px 6px', fontSize: '0.75rem', border: '1px solid #fde68a', borderRadius: 4, outline: 'none', background: 'white', fontFamily: 'monospace' }}
                      />
                      <button onClick={() => {
                        const max = Math.min(loyalty.points_balance, remainingAfterGc);
                        setPointsRedeemInput(max);
                        setPointsRedeem(max);
                      }} style={{ background: 'none', border: 'none', color: '#92400e', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600 }}>Use max</button>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="small-text">Subtotal</span>
                <span className="small-text tabular-nums" style={{ fontWeight: 500 }}>PKR {subtotal.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="small-text" style={{ color: '#15803d' }}>Discount</span>
                  <span className="small-text tabular-nums" style={{ fontWeight: 500, color: '#15803d' }}>− PKR {discount.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="small-text">Shipping{shippingInfo.label ? ` (${shippingInfo.label})` : ''}</span>
                <span className="small-text tabular-nums" style={{ fontWeight: 500, color: shipping === 0 ? 'var(--success)' : 'inherit' }}>{shipping === 0 ? 'FREE' : `PKR ${shipping}`}</span>
              </div>
              {giftCardCovers > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="small-text" style={{ color: '#15803d' }}>Gift card</span>
                  <span className="small-text tabular-nums" style={{ fontWeight: 500, color: '#15803d' }}>− PKR {giftCardCovers.toLocaleString()}</span>
                </div>
              )}
              {pointsCovers > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="small-text" style={{ color: '#92400e' }}>Loyalty points</span>
                  <span className="small-text tabular-nums" style={{ fontWeight: 500, color: '#92400e' }}>− PKR {pointsCovers.toLocaleString()}</span>
                </div>
              )}
              <hr className="hairline" style={{ margin: '16px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                <span className="h3">Due now</span>
                <span className="h3 tabular-nums">PKR {total.toLocaleString()}</span>
              </div>
              {submitError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: '0.8125rem' }}>
                  {submitError}
                </div>
              )}
              <button className="btn-primary" style={{ width: '100%' }} onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Placing Order…' : payMethod === 'jazzcash' || payMethod === 'easypaisa' ? `Continue to ${payMethod === 'jazzcash' ? 'JazzCash' : 'Easypaisa'} →` : 'Place Order'}
              </button>
              <p className="small-text" style={{ textAlign: 'center', marginTop: 12, color: 'var(--ink-500)' }}>Secure checkout · COD available</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
