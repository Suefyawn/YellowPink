'use client';

import { useEffect, type RefObject } from 'react';

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

/**
 * Keep Tab focus inside `ref.current` while `active`. On open, focus the
 * first focusable element inside the container. On close, restore focus
 * to whatever was focused before opening. Standard modal-dialog pattern.
 */
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap<T extends HTMLElement>(active: boolean, ref: RefObject<T | null>): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const container = ref.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Defer initial focus a tick so the open transition can start first.
    const initial = setTimeout(() => {
      const first = container.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }, 50);

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => !el.hasAttribute('aria-hidden'));
      if (list.length === 0) return;
      const first = list[0];
      const last  = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKeydown);

    return () => {
      clearTimeout(initial);
      document.removeEventListener('keydown', onKeydown);
      // Restore focus after the panel closes so keyboard users land back
      // where they were (e.g. on the "Filters" pill that opened the rail).
      previouslyFocused?.focus?.();
    };
  }, [active, ref]);
}
