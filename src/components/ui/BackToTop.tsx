'use client';

import { useEffect, useState } from 'react';

// Floating "back to top" control. Long pages (shop, collections, blog) require
// a lot of scrolling on mobile with no fast way back to the nav. Appears after
// the user scrolls ~2 viewports down; smooth-scrolls to top (respecting the
// OS reduce-motion preference).
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 2);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      style={{
        position: 'fixed', right: 'max(16px, env(safe-area-inset-right))',
        // Sits above the persistent WhatsApp FAB (56px bubble at bottom-right)
        // so the two don't overlap when both are visible.
        bottom: 'calc(max(16px, env(safe-area-inset-bottom)) + 68px)',
        width: 44, height: 44, borderRadius: '50%',
        background: 'var(--ink-900)', color: '#fff',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 14px rgba(0,0,0,0.22)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 200ms ease-out, transform 200ms ease-out',
        zIndex: 80,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}
