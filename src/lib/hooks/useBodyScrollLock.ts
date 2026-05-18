'use client';

import { useEffect } from 'react';

// Locks <body> scroll while a modal/drawer is open. Restores the original
// overflow on close. Pass `lock=true` to engage.
//
// iOS Safari quirk: simply setting `overflow:hidden` on body doesn't
// prevent rubber-band scroll. We also pin position via top + restore on
// close, which is the most reliable cross-browser pattern.

export function useBodyScrollLock(lock: boolean): void {
  useEffect(() => {
    if (!lock || typeof document === 'undefined') return;

    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;

    const prevOverflow      = body.style.overflow;
    const prevPosition      = body.style.position;
    const prevTop           = body.style.top;
    const prevWidth         = body.style.width;
    const prevHtmlOverflow  = html.style.overflow;

    body.style.overflow = 'hidden';
    // iOS-safe: pin the body in place so touch scrolling is blocked.
    body.style.position = 'fixed';
    body.style.top      = `-${scrollY}px`;
    body.style.width    = '100%';
    html.style.overflow = 'hidden';

    return () => {
      body.style.overflow = prevOverflow;
      body.style.position = prevPosition;
      body.style.top      = prevTop;
      body.style.width    = prevWidth;
      html.style.overflow = prevHtmlOverflow;
      // Restore scroll position the user was at before opening.
      window.scrollTo(0, scrollY);
    };
  }, [lock]);
}

/** Convenience hook: fires `onClose` when Escape is pressed while `active`. */
export function useEscapeKey(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, onClose]);
}
