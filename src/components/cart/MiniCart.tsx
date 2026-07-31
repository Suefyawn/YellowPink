'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import { useCart } from '@/context/CartContext';
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from '@/lib/hooks/useBodyScrollLock';
import { brandPlusName } from '@/lib/product-display';
import { useCommerceSettings } from '@/context/CommerceSettings';
import { RETURNS_WINDOW_DAYS } from '@/lib/commerce';
import { vendorFreeShippingEligible } from '@/lib/vendor-shipping';
import { FreeShippingProgress } from '@/components/cart/FreeShippingProgress';
import type { Product } from '@/types';

export function MiniCart({ crossSell = [] }: { crossSell?: Product[] }) {
  const { cartItems, cartOpen, setCartOpen, removeFromCart, updateQty, addToCart } = useCart();
  const { freeShippingEnabled, freeShippingThreshold, defaultShippingRate, vendorFreeShipThresholds } = useCommerceSettings();
  const router = useRouter();
  const pathname = usePathname();
  useBodyScrollLock(cartOpen);
  useEscapeKey(cartOpen, () => setCartOpen(false));
  const panelRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(cartOpen, panelRef);
  // Brief "Added ✓" state on the cross-sell row's button.
  const [crossSellAdded, setCrossSellAdded] = useState(false);
  const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  // Standard-zone free-delivery check; mirrors FreeShippingProgress (which
  // spells out the zone caveat right above these items). The vendor rule
  // (NB Sons ≥ Rs 1,999) unlocks free delivery nationwide on its own.
  const deliveryFree =
    (freeShippingEnabled && freeShippingThreshold > 0 && total >= freeShippingThreshold) ||
    vendorFreeShippingEligible(cartItems, vendorFreeShipThresholds);
  // One tappable cross-sell: first bestseller that isn't already in the bag
  // and is one-tap addable (simple product, purchasable). Replaces the old
  // static "Add a Free Sample" box, which promised something and offered no
  // way to act on it.
  const crossSellPick = crossSell.find(p =>
    !cartItems.some(c => c.id === p.id)
    && p.kind !== 'variable'
    && !(p.track_inventory !== false && typeof p.stock === 'number' && p.stock <= 0),
  );

  // Close on any route change, including browser/gesture back navigation,
  // which fires none of this component's own close handlers, see the same
  // fix in SearchOverlay.tsx.
  useEffect(() => {
    setCartOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={cartOpen}
        aria-label="Shopping cart"
        aria-hidden={!cartOpen}
        // When closed the panel stays mounted (for the slide transition); mark
        // it inert so its buttons/links aren't focusable or in the a11y tree.
        inert={!cartOpen}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '90vw',
          background: 'var(--paper)', boxShadow: 'var(--shadow-1)',
          transform: cartOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms ease-out', zIndex: 201,
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="h3">Your Cart</span>
          <button
            onClick={() => setCartOpen(false)}
            aria-label="Close cart"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ink-900)', fontSize: '1.5rem', lineHeight: 1,
              width: 40, height: 40, borderRadius: 8,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginRight: -8,
            }}
          >×</button>
        </div>

        {/* The vendor rule applies even with the master switch off, so gate on
            either; the bar itself returns null when neither rule is in play. */}
        {(freeShippingEnabled || deliveryFree) && cartItems.length > 0 && (
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--line)' }}>
          <FreeShippingProgress subtotal={cartItems.reduce((s, i) => s + i.price * i.qty, 0)} items={cartItems} />
        </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {cartItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-500)' }}>
              <p className="body-text">Your cart is empty</p>
            </div>
          ) : cartItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <Link
                href={`/product/${item.slug}`}
                onClick={() => setCartOpen(false)}
                style={{ width: 64, height: 64, borderRadius: 'var(--radius-card)', flexShrink: 0, overflow: 'hidden', background: 'var(--paper2)', display: 'block' }}
              >
                <ProductImage src={item.image_url} alt={brandPlusName(item.brand, item.name)} width={64} height={64} />
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Overline style={{ color: 'var(--ink-500)', fontSize: '0.6875rem', display: 'block', letterSpacing: '0.12em' }}>{item.brand}</Overline>
                <Link
                  href={`/product/${item.slug}`}
                  onClick={() => setCartOpen(false)}
                  style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 2, display: 'block', color: 'var(--ink-900)', textDecoration: 'none' }}
                >
                  {item.name}
                </Link>
                {(item.variant_label ?? item.variant) && (
                  <div className="small-text" style={{ fontSize: '0.6875rem', color: 'var(--ink-500)' }}>
                    {item.variant_label ?? item.variant}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)' }}>
                    <button type="button" aria-label={`Decrease quantity of ${item.name}`} onClick={() => updateQty(i, -1)} style={{ width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <span aria-live="polite" style={{ width: 28, textAlign: 'center', fontSize: '0.875rem', fontWeight: 500 }}>{item.qty}</span>
                    <button type="button" aria-label={`Increase quantity of ${item.name}`} onClick={() => updateQty(i, 1)} style={{ width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  </div>
                  <span className="tabular-nums" style={{ fontSize: '0.875rem', fontWeight: 600 }}>PKR {(item.price * item.qty).toLocaleString()}</span>
                </div>
              </div>
              <button type="button" aria-label={`Remove ${item.name} from cart`} onClick={() => removeFromCart(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-500)', fontSize: '1.25rem', alignSelf: 'flex-start', width: 40, height: 40, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
            </div>
          ))}
          {cartItems.length > 0 && crossSellPick && (
            <div style={{ marginTop: 16, padding: 12, background: 'var(--paper2)', borderRadius: 'var(--radius-card)', border: '1px solid var(--line)' }}>
              <Overline style={{ color: 'var(--brand-pink-text)', display: 'block', marginBottom: 8, fontSize: '0.6875rem' }}>Goes well with your order</Overline>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Link
                  href={`/product/${crossSellPick.slug}`}
                  onClick={() => setCartOpen(false)}
                  style={{ width: 48, height: 48, borderRadius: 'var(--radius-card)', flexShrink: 0, overflow: 'hidden', background: 'var(--paper)', display: 'block' }}
                >
                  <ProductImage src={crossSellPick.image_url} alt={brandPlusName(crossSellPick.brand, crossSellPick.name)} width={48} height={48} />
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    href={`/product/${crossSellPick.slug}`}
                    onClick={() => setCartOpen(false)}
                    style={{
                      fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-900)', textDecoration: 'none',
                      display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {crossSellPick.name}
                  </Link>
                  <span className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--ink-700)' }}>
                    PKR {crossSellPick.price.toLocaleString()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // openDrawer:false — the drawer is already open, and
                    // re-triggering the open animation reads as a glitch.
                    if (addToCart({ ...crossSellPick, qty: 1 }, { openDrawer: false })) {
                      setCrossSellAdded(true);
                      window.setTimeout(() => setCrossSellAdded(false), 1400);
                    }
                  }}
                  aria-label={`Add ${crossSellPick.name} to cart`}
                  style={{
                    flexShrink: 0, minHeight: 40, padding: '8px 14px',
                    background: crossSellAdded ? 'var(--brand-pink-cta, #C5286A)' : 'transparent',
                    color: crossSellAdded ? '#fff' : 'var(--brand-pink-cta, #C5286A)',
                    border: '1px solid var(--brand-pink-cta, #C5286A)', borderRadius: 'var(--radius-pill)',
                    fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    transition: 'background 200ms, color 200ms',
                  }}
                >
                  {crossSellAdded ? 'Added ✓' : 'Add'}
                </button>
              </div>
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div style={{ padding: '16px 24px 20px', borderTop: '1px solid var(--line)' }}>
            {/* Delivery line above the total: the old footer showed a bare
                subtotal and left a COD shopper to discover the delivery
                charge only at checkout — exactly where the funnel leaks.
                Standard-zone figures; checkout stays authoritative. */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span className="small-text" style={{ color: 'var(--ink-700)' }}>Delivery</span>
              <span className="small-text tabular-nums" style={{ color: deliveryFree ? '#15803d' : 'var(--ink-700)', fontWeight: deliveryFree ? 600 : 400 }}>
                {deliveryFree ? 'FREE' : defaultShippingRate > 0 ? `from PKR ${defaultShippingRate.toLocaleString()}` : 'shown at checkout'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <span className="h3">Total</span>
              <span className="h3 tabular-nums">PKR {total.toLocaleString()}</span>
            </div>
            {/* One dominant action. View Cart used to be a near-equal second
                button; the funnel showed the drawer is the real bridge to
                checkout (37 adds → 3 cart views), so Checkout gets the full
                visual weight and View Cart becomes a quiet text link. */}
            <button className="btn-primary" style={{ width: '100%', minHeight: 48 }} onClick={handleCheckout}>Checkout</button>
            <div style={{ marginTop: 8, textAlign: 'center', fontSize: '0.6875rem', color: 'var(--ink-700)' }}>
              Cash on delivery · nationwide · {RETURNS_WINDOW_DAYS}-day returns
            </div>
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button onClick={handleViewCart} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 600,
                color: 'var(--ink-700)', textDecoration: 'underline', textUnderlineOffset: 3,
              }}>View cart</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
