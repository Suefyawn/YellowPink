'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Overline } from '@/components/ui/Overline';
import { useCart } from '@/context/CartContext';

const FREE_SHIPPING = 2500;

export function CartPage() {
  const { cartItems, removeFromCart, updateQty } = useCart();
  const router = useRouter();
  const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const progress = Math.min(total / FREE_SHIPPING, 1);
  const shipping = total >= FREE_SHIPPING ? 0 : 200;

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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 48, marginTop: 32 }} className="duo-grid">
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="body-text">Subtotal</span>
                <span className="body-text tabular-nums" style={{ fontWeight: 500 }}>PKR {total.toLocaleString()}</span>
              </div>
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
