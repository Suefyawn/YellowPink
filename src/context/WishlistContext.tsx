'use client';

import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Server-render-safe useLayoutEffect (same shim as CartContext) — Next
// pre-renders client components and bare useLayoutEffect warns there.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface WishlistContextValue {
  wishlist: string[];
  toggle: (id: string) => void;
  isWishlisted: (id: string) => boolean;
  /** Remove every id from the list, used by the "Clear all" affordance
   *  on the wishlist page. */
  clear: () => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);
const KEY = 'yp_wishlist';

function load(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  // Start empty so the first client render matches the server-rendered HTML.
  // Initialising from localStorage synchronously made them differ (server =
  // empty, client = stored), which triggered React hydration errors (#418)
  // and broke interactivity site-wide, the heart on every product tile
  // renders from this state. localStorage is an external store; it is
  // synced in after mount. (CartContext already does exactly this.)
  const [wishlist, setWishlist] = useState<string[]>([]);

  // Guards the persist effect: it must not run until the stored list has
  // been read, or its mount-time run (state still []) would overwrite it.
  const hydrated = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWishlist(load());
    hydrated.current = true;
  }, []);

  // Layout effect (pre-paint) so a visible heart toggle implies the write
  // already hit localStorage — a passive effect could lose a toggle if the
  // user navigated (full page load) right after tapping. See CartContext.
  useIsomorphicLayoutEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem(KEY, JSON.stringify(wishlist)); } catch { /* quota */ }
  }, [wishlist]);

  const toggle = useCallback((id: string) => {
    setWishlist(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const isWishlisted = useCallback((id: string) => wishlist.includes(id), [wishlist]);
  const clear = useCallback(() => setWishlist([]), []);

  return (
    <WishlistContext.Provider value={{ wishlist, toggle, isWishlisted, clear }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
