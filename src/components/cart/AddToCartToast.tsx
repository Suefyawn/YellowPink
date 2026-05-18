'use client';

// Small visible toast that confirms an add-to-cart for sighted users.
// Pairs with CartAnnouncer (which handles screen readers via aria-live).
// The mini-cart drawer also opens on add — the toast is the at-a-glance
// affordance for when the user is mid-page and not focusing on the drawer.

import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/context/CartContext';

interface Toast { id: number; label: string; price: number; qty: number }

export function AddToCartToast() {
  const { cartItems, cartCount } = useCart();
  const prevCountRef = useRef<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const prev = prevCountRef.current;
    // First render — establish baseline; don't toast restored cart on reload.
    if (prev === null) { prevCountRef.current = cartCount; return; }
    if (cartCount > prev) {
      const last = cartItems[cartItems.length - 1];
      if (last) {
        const id = Date.now();
        const label = `${last.brand} ${last.name}`;
        setToasts(prev => [...prev, { id, label, price: last.price, qty: cartCount - prevCountRef.current! }]);
        // Auto-dismiss after 3.2 s.
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
      }
    }
    prevCountRef.current = cartCount;
  }, [cartCount, cartItems]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 250,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            background: 'var(--ink-900)',
            color: 'var(--paper)',
            padding: '12px 16px',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            maxWidth: 320,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            animation: 'toast-in 220ms ease-out',
          }}
        >
          <span
            style={{
              flexShrink: 0,
              width: 22, height: 22, borderRadius: '50%',
              background: 'var(--brand-pink)', color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.875rem', fontWeight: 700,
            }}
            aria-hidden="true"
          >✓</span>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Added to cart: <strong style={{ fontWeight: 700 }}>{t.label}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}
