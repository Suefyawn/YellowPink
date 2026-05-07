'use client';

import { useRouter } from 'next/navigation';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import { useCart } from '@/context/CartContext';

const FREE_SHIPPING = 2500;

export function MiniCart() {
  const { cartItems, cartOpen, setCartOpen, removeFromCart, updateQty } = useCart();
  const router = useRouter();
  const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const progress = Math.min(total / FREE_SHIPPING, 1);

  const handleViewCart = () => {
    setCartOpen(false);
    router.push('/cart');
  };

  const handleCheckout = () => {
    setCartOpen(false);
    router.push('/checkout');
  };

  return (
    <>
      <div onClick={() => setCartOpen(false)} style={{
        position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.4)',
        opacity: cartOpen ? 1 : 0, pointerEvents: cartOpen ? 'auto' : 'none',
        transition: 'opacity 250ms ease-out', zIndex: 200,
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '90vw',
        background: 'var(--paper)', boxShadow: 'var(--shadow-1)',
        transform: cartOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms ease-out', zIndex: 201,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="h3">Your Cart</span>
          <button onClick={() => setCartOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-900)', fontSize: '1.25rem' }}>×</button>
        </div>

        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)' }}>
          <div className="small-text" style={{ marginBottom: 8, color: 'var(--ink-700)' }}>
            {progress >= 1
              ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>You qualify for free shipping!</span>
              : <>PKR {(FREE_SHIPPING - total).toLocaleString()} away from <span style={{ color: 'var(--brand-pink)', fontWeight: 600 }}>FREE</span> shipping</>
            }
          </div>
          <div style={{ height: 4, background: 'var(--paper2)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progress * 100}%`,
              background: 'linear-gradient(90deg, var(--brand-yellow), var(--brand-pink))',
              borderRadius: 'var(--radius-pill)', transition: 'width 400ms ease-out',
            }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {cartItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-500)' }}>
              <p className="body-text">Your cart is empty</p>
            </div>
          ) : cartItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-card)', flexShrink: 0, overflow: 'hidden', background: 'var(--paper2)' }}>
                <ProductImage src={item.image_url} alt={item.name} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Overline style={{ color: 'var(--ink-500)', fontSize: '0.5625rem', display: 'block' }}>{item.brand}</Overline>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 2 }}>{item.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)' }}>
                    <button onClick={() => updateQty(i, -1)} style={{ width: 28, height: 28, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>−</button>
                    <span style={{ width: 24, textAlign: 'center', fontSize: '0.8125rem', fontWeight: 500 }}>{item.qty}</span>
                    <button onClick={() => updateQty(i, 1)} style={{ width: 28, height: 28, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>+</button>
                  </div>
                  <span className="tabular-nums" style={{ fontSize: '0.875rem', fontWeight: 600 }}>PKR {(item.price * item.qty).toLocaleString()}</span>
                </div>
              </div>
              <button onClick={() => removeFromCart(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-500)', fontSize: '1rem', alignSelf: 'flex-start', marginTop: 4 }}>×</button>
            </div>
          ))}
          {cartItems.length > 0 && (
            <div style={{ marginTop: 16, padding: 12, background: 'var(--paper2)', borderRadius: 'var(--radius-card)', border: '1px solid var(--line)' }}>
              <Overline style={{ color: 'var(--brand-pink)', display: 'block', marginBottom: 4, fontSize: '0.625rem' }}>Add a Free Sample</Overline>
              <div className="small-text">Get a complimentary skincare sample with your order.</div>
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div style={{ padding: '20px 24px', borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span className="h3">Total</span>
              <span className="h3 tabular-nums">PKR {total.toLocaleString()}</span>
            </div>
            <button className="btn-primary" style={{ width: '100%' }} onClick={handleCheckout}>Checkout</button>
            <button onClick={handleViewCart} style={{
              width: '100%', marginTop: 8, padding: '10px 0', background: 'none',
              border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 600,
              color: 'var(--ink-900)', letterSpacing: '0.04em',
            }}>View Cart</button>
          </div>
        )}
      </div>
    </>
  );
}
