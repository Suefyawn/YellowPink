'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { CartItem, Product } from '@/types';

interface CartContextValue {
  cartItems: CartItem[];
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  addToCart: (product: Product & { qty?: number }) => void;
  removeFromCart: (idx: number) => void;
  updateQty: (idx: number, delta: number) => void;
  clearCart: () => void;
  cartCount: number;
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
  const [cartItems, setCartItems] = useState<CartItem[]>(loadCart);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cartItems)); } catch { /* quota exceeded */ }
  }, [cartItems]);

  const addToCart = (product: Product & { qty?: number }) => {
    setCartItems(prev => {
      const existing = prev.findIndex(i => i.id === product.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], qty: updated[existing].qty + (product.qty ?? 1) };
        return updated;
      }
      return [...prev, { ...product, qty: product.qty ?? 1 }];
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

  const clearCart = () => setCartItems([]);

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

  return (
    <CartContext.Provider value={{ cartItems, cartOpen, setCartOpen, addToCart, removeFromCart, updateQty, clearCart, cartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
