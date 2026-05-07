'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Overline } from '@/components/ui/Overline';
import { useCart } from '@/context/CartContext';
import { getBrowserClient } from '@/lib/supabase-browser';
import type { Coupon } from '@/types';

const FREE_SHIPPING = 2500;

export function CartPage() {
  const { cartItems, removeFromCart, updateQty, appliedCoupon, setAppliedCoupon } = useCart();
  const router = useRouter();

  const [couponCode, setCouponCode] = useState(appliedCoupon?.code ?? '');
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = appliedCoupon
    ? appliedCoupon.type === 'percent'
      ? Math.round(subtotal * appliedCoupon.value / 100)
      : appliedCoupon.value
    : 0;
  const total = Math.max(0, subtotal - discount);
  const progress = Math.min(total / FREE_SHIPPING, 1);
  const shipping = total >= FREE_SHIPPING ? 0 : 200;

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError('');
    setCouponLoading(true);
    const sb = getBrowserClient();
    const { data } = await sb.from('coupons').select('*').eq('code', couponCode.trim().toUpperCase()).eq('active', true).single();
    setCouponLoading(false);
    if (!data) { setCouponError('Invalid or inactive coupon code'); return; }
    const c = data as Coupon;
    if (c.expires_at && new Date(c.expires_at) < new Date()) { setCouponError('This coupon has expired'); return; }
    if (c.max_uses !== null && c.used_count >= c.max_uses) { setCouponError('This coupon has reached its usage limit'); return; }
    if (subtotal < c.min_order) { setCouponError(`Minimum order of PKR ${c.min_order.toLocaleString()} required`); return; }
    setAppliedCoupon(c);
    setCouponCode(c.code);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  if (cartItems.length === 0) {
    return (
      <section style={{ padding: 'var(--section-gap) 0', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 560 }}>
          <h1 className="h1" style={{ marginTop: 20, marginBottom: 12 }}>Your cart is empty</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 28 }}>
            Looks like you haven&apos;t added anything yet. Explore our collection and find something you&apos;ll love.
          </p>
          <Link href="/shop" className="btn-primary">Continue Shopping</Link>
        </div>
      </section>
    );
  }

  return (
    <div>
      <section style={{ padding: '48px 0 0' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Shopping Cart</Overline>
          <h1 className="display-l" style={{ fontSize: '2rem', marginBottom: 32 }}>
            Your Cart ({cartItems.reduce((s, i) => s + i.qty, 0)})
          </h1>
        </div>
      </section>

      <section style={{ padding: '0 0 var(--section-gap)' }}>
        <div className="container">
          <div style={{ padding: '16px 0 32px', borderBottom: '1px solid var(--line)' }}>
            <div className="small-text" style={{ marginBottom: 8, color: 'var(--ink-700)' }}>
              {progress >= 1
                ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>You qualify for free shipping!</span>
                : <>PKR {(FREE_SHIPPING - total).toLocaleString()} away from <span style={{ color: 'var(--brand-pink)', fontWeight: 600 }}>FREE</span> shipping</>
              }
            </div>
            <div style={{ height: 4, background: 'var(--paper2)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', maxWidth: 400 }}>
              <div style={{ height: '100%', width: `${progress * 100}%`, background: 'linear-gradient(90deg, var(--brand-yellow), var(--brand-pink))', borderRadius: 'var(--radius-pill)', transition: 'width 400ms ease-out' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 48, marginTop: 32 }} className="cart-grid">
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 32px', gap: 16, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
                <Overline style={{ color: 'var(--ink-500)' }}>Product</Overline>
                <Overline style={{ color: 'var(--ink-500)', textAlign: 'center' }}>Quantity</Overline>
                <Overline style={{ color: 'var(--ink-500)', textAlign: 'right' }}>Total</Overline>
                <span />
              </div>
              {cartItems.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 32px', gap: 16, alignItems: 'center', padding: '20px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div className="img-placeholder" style={{ width: 72, height: 72, borderRadius: 'var(--radius-card)', flexShrink: 0, fontSize: '0.5rem' }}>photo</div>
                    <div>
                      <Overline style={{ color: 'var(--ink-500)', fontSize: '0.5625rem', display: 'block' }}>{item.brand}</Overline>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{item.name}</div>
                      {item.variant && <div className="small-text">{item.variant}</div>}
                      <div className="tabular-nums small-text" style={{ marginTop: 2 }}>PKR {item.price.toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)' }}>
                      <button onClick={() => updateQty(i, -1)} style={{ width: 32, height: 32, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>−</button>
                      <span style={{ width: 28, textAlign: 'center', fontSize: '0.8125rem', fontWeight: 500 }}>{item.qty}</span>
                      <button onClick={() => updateQty(i, 1)} style={{ width: 32, height: 32, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>+</button>
                    </div>
                  </div>
                  <div className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.9375rem' }}>PKR {(item.price * item.qty).toLocaleString()}</div>
                  <button onClick={() => removeFromCart(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-500)', fontSize: '1rem' }}>×</button>
                </div>
              ))}
              <div style={{ marginTop: 20 }}>
                <Link href="/shop" className="btn-secondary">Continue Shopping</Link>
              </div>
            </div>

            <div style={{ background: 'var(--paper2)', borderRadius: 'var(--radius-card)', padding: 28, border: '1px solid var(--line)', alignSelf: 'start', position: 'sticky', top: 100 }}>
              <Overline style={{ display: 'block', marginBottom: 20, color: 'var(--ink-500)' }}>Order Summary</Overline>

              {/* Coupon code */}
              <div style={{ marginBottom: 20 }}>
                {appliedCoupon ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 12px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', fontFamily: 'monospace' }}>{appliedCoupon.code}</span>
                      <span style={{ fontSize: '0.75rem', color: '#15803d', marginLeft: 6 }}>
                        — {appliedCoupon.type === 'percent' ? `${appliedCoupon.value}% off` : `PKR ${appliedCoupon.value.toLocaleString()} off`}
                      </span>
                    </div>
                    <button onClick={removeCoupon} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1rem', lineHeight: 1, padding: 2 }}>×</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={couponCode}
                      onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                      onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                      placeholder="Coupon code"
                      style={{
                        flex: 1, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8,
                        fontSize: '0.875rem', fontFamily: 'monospace', background: 'white', outline: 'none',
                        color: 'var(--ink-900)', textTransform: 'uppercase',
                      }}
                    />
                    <button
                      onClick={applyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      style={{
                        padding: '9px 14px', background: 'var(--ink-900)', color: 'white',
                        border: 'none', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600,
                        cursor: couponLoading || !couponCode.trim() ? 'not-allowed' : 'pointer',
                        opacity: couponLoading || !couponCode.trim() ? 0.5 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {couponLoading ? '…' : 'Apply'}
                    </button>
                  </div>
                )}
                {couponError && (
                  <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>{couponError}</p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="body-text">Subtotal</span>
                <span className="body-text tabular-nums" style={{ fontWeight: 500 }}>PKR {subtotal.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span className="body-text" style={{ color: '#15803d' }}>Discount</span>
                  <span className="body-text tabular-nums" style={{ fontWeight: 500, color: '#15803d' }}>− PKR {discount.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="body-text">Shipping</span>
                <span className="body-text tabular-nums" style={{ fontWeight: 500, color: shipping === 0 ? 'var(--success)' : 'inherit' }}>
                  {shipping === 0 ? 'FREE' : `PKR ${shipping}`}
                </span>
              </div>
              <hr className="hairline" style={{ margin: '16px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                <span className="h3">Total</span>
                <span className="h3 tabular-nums">PKR {(total + shipping).toLocaleString()}</span>
              </div>
              <button className="btn-primary" style={{ width: '100%' }} onClick={() => router.push('/checkout')}>Proceed to Checkout</button>
              <p className="small-text" style={{ textAlign: 'center', marginTop: 12, color: 'var(--ink-500)' }}>COD available nationwide</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
