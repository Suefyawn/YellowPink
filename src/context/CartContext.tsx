'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { CartItem, Coupon, Product } from '@/types';

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
  addToCart: (product: AddToCartInput) => void;
  removeFromCart: (idx: number) => void;
  updateQty: (idx: number, delta: number) => void;
  clearCart: () => void;
  cartCount: number;
  appliedCoupon: Coupon | null;
  setAppliedCoupon: (c: Coupon | null) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const CART_KEY = 'yp_cart';

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);

  // Load from localStorage after hydration to avoid SSR/client mismatch
  useEffect(() => {
    setCartItems(loadCart());
  }, []);

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cartItems)); } catch { /* quota exceeded */ }
  }, [cartItems]);

  const addToCart = (product: AddToCartInput) => {
    setCartItems(prev => {
      // Dedupe key: same product AND same variant. Adding two different shades
      // of the same product results in two cart lines.
      const variantId = product.variant_id ?? null;
      const existing = prev.findIndex(i => i.id === product.id && (i.variant_id ?? null) === variantId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], qty: updated[existing].qty + (product.qty ?? 1) };
        return updated;
      }
      return [...prev, {
        ...product,
        qty: product.qty ?? 1,
        variant_id: variantId,
        variant_label: product.variant_label ?? null,
      }];
    });
    setCartOpen(true);
  };

  const removeFromCart = (idx: number) =>
    setCartItems(prev => prev.filter((_, i) => i !== idx));

  const updateQty = (idx: number, delta: number) =>
    setCartItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], qty: Math.max(1, updated[idx].qty + delta) };
      return updated;
    });

  const clearCart = () => {
    setCartItems([]);
    setAppliedCoupon(null);
  };

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

  return (
    <CartContext.Provider value={{ cartItems, cartOpen, setCartOpen, addToCart, removeFromCart, updateQty, clearCart, cartCount, appliedCoupon, setAppliedCoupon }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
