'use client';

import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import type { CartItem, Coupon, Product } from '@/types';

// useLayoutEffect that is safe to ship in a component that also renders on
// the server (Next pre-renders 'use client' components; bare useLayoutEffect
// there triggers a React warning). On the server it falls back to useEffect,
// which never runs anyway.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Optional variant info when adding a variable product to the cart. */
export interface AddToCartInput extends Product {
  qty?: number;
  variant_id?: string | null;
  variant_label?: string | null;
}

interface CartContextValue {
  cartItems: CartItem[];
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  /** Returns true when at least one unit was actually added; false when the
   *  stock clamp dropped the add entirely (sold out, or the line is already
   *  at the available-stock cap). Callers must not show success feedback on
   *  false — the toast/drawer/analytics are only fired internally on true. */
  /** opts.openDrawer=false adds silently (no drawer, no toast) — the Buy Now
   *  fast path navigates straight to checkout and the drawer would only
   *  flash mid-navigation. Analytics fire either way. */
  addToCart: (product: AddToCartInput, opts?: { openDrawer?: boolean }) => boolean;
  /** Silently swap a saved snapshot back into an EMPTY cart (failed-payment
   *  recovery). Unlike `addToCart` this fires no toast/drawer/analytics — the
   *  shopper didn't add anything, we're undoing our own pre-gateway clear.
   *  Returns false (and does nothing) if the cart already has items. */
  restoreCart: (items: CartItem[]) => boolean;
  removeFromCart: (idx: number) => void;
  updateQty: (idx: number, delta: number) => void;
  clearCart: () => void;
  cartCount: number;
  /** Increments every time `addToCart` is called. The "add to cart" toast
   *  subscribes to this rather than `cartCount` so it doesn't flash on
   *  page-load hydration of a saved cart. */
  addCounter: number;
  /** The last item the user explicitly added, paired with `addCounter`
   *  so the toast can read the brand+name without re-deriving from the
   *  end of `cartItems` (which is wrong if the add merged into an
   *  existing line). */
  lastAdded: { name: string; brand?: string | null; price: number; qty: number } | null;
  appliedCoupon: Coupon | null;
  setAppliedCoupon: (c: Coupon | null) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const CART_KEY = 'yp_cart';
const COUPON_KEY = 'yp_coupon';

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function loadCoupon(): Coupon | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COUPON_KEY);
    return raw ? (JSON.parse(raw) as Coupon) : null;
  } catch {
    return null;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [addCounter, setAddCounter] = useState(0);
  const [lastAdded, setLastAdded] = useState<CartContextValue['lastAdded']>(null);

  // Guards the persist effects below: they must not run until the saved cart
  // has been read, or the mount-time run (state still []) would overwrite it.
  const hydrated = useRef(false);

  // Load from localStorage after hydration to avoid SSR/client mismatch.
  // setState-in-effect is intentional: the cart is persisted in an external
  // store (localStorage) and we sync it into React state at mount.
  useEffect(() => {
    // The applied coupon is persisted alongside the cart so it survives a
    // refresh or a full page load on the way from /cart to /checkout, the
    // server still re-validates the code at order time.
    /* eslint-disable react-hooks/set-state-in-effect */
    setCartItems(loadCart());
    setAppliedCoupon(loadCoupon());
    /* eslint-enable react-hooks/set-state-in-effect */
    hydrated.current = true;
  }, []);

  // Persist in a *layout* effect (flushes before paint) so anything the user
  // can see — the add-to-cart toast, the drawer — implies the write already
  // happened. With a passive effect there was a window after the toast
  // painted where a full-page navigation unloaded the page before the effect
  // ran, silently losing the add (observed as a CI flake; a real hazard for
  // a fast tap-then-navigate on mobile too).
  useIsomorphicLayoutEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem(CART_KEY, JSON.stringify(cartItems)); } catch { /* quota exceeded */ }
  }, [cartItems]);

  useIsomorphicLayoutEffect(() => {
    if (!hydrated.current) return;
    try {
      if (appliedCoupon) localStorage.setItem(COUPON_KEY, JSON.stringify(appliedCoupon));
      else localStorage.removeItem(COUPON_KEY);
    } catch { /* quota exceeded */ }
  }, [appliedCoupon]);

  const addToCart = (product: AddToCartInput, opts?: { openDrawer?: boolean }): boolean => {
    // Dedupe key: same product AND same variant. Adding two different shades
    // of the same product results in two cart lines.
    const variantId = product.variant_id ?? null;
    // P1: clamp qty against available stock. `product.stock` is the live
    // value from the PDP/grid props; treat undefined as unlimited (some
    // demo items have no stock field). The RPC has authoritative truth
    // and will still reject overshoot, but stopping at the UI saves a
    // round-trip and a confusing toast.
    // Untracked products (inventory managed externally) have no cap.
    const stockCap = product.track_inventory === false || typeof product.stock !== 'number'
      ? Infinity
      : product.stock;
    const requested = product.qty ?? 1;

    // Decide the outcome AGAINST CURRENT STATE, before touching it, so the
    // success feedback below (toast, drawer, analytics) can be gated on
    // whether anything was actually added. Previously the clamp could drop
    // the add inside the updater while the toast/drawer fired regardless —
    // the button flashed "Added ✓" with nothing added. Safe outside the
    // updater: adds only happen in user-event ticks, never concurrently.
    const existing = cartItems.findIndex(i => i.id === product.id && (i.variant_id ?? null) === variantId);
    const addedQty = existing >= 0
      ? Math.min(cartItems[existing].qty + requested, stockCap) - cartItems[existing].qty
      // Never create a quantity-0 line: a sold-out product (stockCap 0)
      // would otherwise land in the cart as a phantom line the shopper
      // can't check out (the order RPC rejects it with a raw product-id
      // error).
      : Math.min(requested, stockCap) >= 1 ? Math.min(requested, stockCap) : 0;
    if (addedQty <= 0) return false;

    setCartItems(prev => {
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], qty: updated[existing].qty + addedQty };
        return updated;
      }
      return [...prev, {
        ...product,
        qty: addedQty,
        variant_id: variantId,
        variant_label: product.variant_label ?? null,
      }];
    });
    track({
      name: 'add_to_cart',
      payload: {
        product_id:   product.id,
        product_name: product.name,
        brand:        product.brand ?? undefined,
        category:     product.category,
        variant:      product.variant_label ?? product.variant,
        price:        product.price,
        qty:          addedQty,
        currency:     'PKR',
      },
    });
    if (opts?.openDrawer !== false) {
      setAddCounter(c => c + 1);
      setLastAdded({
        name:  product.name,
        brand: product.brand,
        price: product.price,
        qty:   addedQty,
      });
      setCartOpen(true);
    }
    return true;
  };

  const restoreCart = (items: CartItem[]): boolean => {
    if (cartItems.length > 0 || items.length === 0) return false;
    setCartItems(items);
    return true;
  };

  const removeFromCart = (idx: number) =>
    setCartItems(prev => prev.filter((_, i) => i !== idx));

  const updateQty = (idx: number, delta: number) =>
    setCartItems(prev => {
      const updated = [...prev];
      const item = updated[idx];
      // P1: clamp upper bound against stock if known. Lower bound stays 1
      // (use removeFromCart to clear the line). The cart item carries the
      // stock value snapshotted at add-time, fresh enough for the qty
      // stepper; the RPC re-validates at submit.
      const stockCap = item.track_inventory === false || typeof item.stock !== 'number'
        ? Infinity
        : item.stock;
      const next = Math.min(stockCap, Math.max(1, item.qty + delta));
      updated[idx] = { ...item, qty: next };
      return updated;
    });

  const clearCart = () => {
    setCartItems([]);
    setAppliedCoupon(null);
  };

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

  return (
    <CartContext.Provider value={{ cartItems, cartOpen, setCartOpen, addToCart, restoreCart, removeFromCart, updateQty, clearCart, cartCount, addCounter, lastAdded, appliedCoupon, setAppliedCoupon }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
