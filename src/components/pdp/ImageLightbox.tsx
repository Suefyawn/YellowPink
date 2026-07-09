'use client';

// Fullscreen product-photo lightbox with pinch / double-tap / drag zoom.
// COD shoppers zoom in to verify seals, batch codes and ingredient panels
// before committing to pay-on-delivery, so this is an objection-remover,
// not eye candy. Pointer-events math (not CSS page zoom) because the PWA
// viewport disables browser pinch and page zoom would drag the chrome in.
//
// Gestures: pinch to zoom (1–4×), drag to pan while zoomed, double-tap to
// toggle 1× ↔ 2.5× at the tap point, Esc / ✕ / backdrop-tap to close.

import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;

export function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [t, setT] = useState({ scale: 1, x: 0, y: 0 });
  // Mirrors "any pointer down" as state so render can disable the transform
  // transition mid-gesture (reading the pointers ref during render is not
  // allowed by the react-hooks/refs rule).
  const [gesturing, setGesturing] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const lastTap = useRef(0);
  const moved = useRef(false);

  // Lock the page behind the overlay; restore on close.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const clamp = (v: { scale: number; x: number; y: number }) => {
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale));
    // At 1× snap back to centre; while zoomed keep the pan within one
    // half-viewport of centre so the image can't be flung off-screen.
    if (scale === 1) return { scale, x: 0, y: 0 };
    const limX = (window.innerWidth * (scale - 1)) / 2;
    const limY = (window.innerHeight * (scale - 1)) / 2;
    return { scale, x: Math.min(limX, Math.max(-limX, v.x)), y: Math.min(limY, Math.max(-limY, v.y)) };
  };

  const dist = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setGesturing(true);
    moved.current = false;
    if (pointers.current.size === 2) {
      pinchStart.current = { dist: dist(), scale: t.scale };
      panStart.current = null;
    } else if (pointers.current.size === 1) {
      panStart.current = { px: e.clientX, py: e.clientY, x: t.x, y: t.y };
    }
  }, [t]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchStart.current) {
      const ratio = dist() / pinchStart.current.dist;
      moved.current = true;
      setT(prev => clamp({ ...prev, scale: pinchStart.current!.scale * ratio }));
    } else if (pointers.current.size === 1 && panStart.current && t.scale > 1) {
      const dx = e.clientX - panStart.current.px;
      const dy = e.clientY - panStart.current.py;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved.current = true;
      setT(prev => clamp({ ...prev, x: panStart.current!.x + dx, y: panStart.current!.y + dy }));
    }
  }, [t.scale]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinchStart.current = null;
    panStart.current = null;
    if (pointers.current.size === 0) setGesturing(false);
    if (pointers.current.size > 0 || moved.current) return;
    // Tap (no movement): double-tap toggles zoom at the tap point;
    // a single tap at 1× closes (matches every native photo viewer).
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      setT(prev => {
        if (prev.scale > 1) return { scale: 1, x: 0, y: 0 };
        const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
        return clamp({
          scale: DOUBLE_TAP_SCALE,
          x: (cx - e.clientX) * (DOUBLE_TAP_SCALE - 1),
          y: (cy - e.clientY) * (DOUBLE_TAP_SCALE - 1),
        });
      });
    } else {
      lastTap.current = now;
      if (t.scale === 1) {
        // Delay so a second tap can cancel the close into a zoom.
        const at = now;
        setTimeout(() => { if (lastTap.current === at) onClose(); }, DOUBLE_TAP_MS);
      }
    }
  }, [onClose, t.scale]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} — zoomed view`}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(8,8,8,0.94)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        touchAction: 'none', overscrollBehavior: 'contain',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={e => setT(prev => clamp({ ...prev, scale: prev.scale * (e.deltaY < 0 ? 1.15 : 0.87) }))}
    >
      {/* Plain <img>: the proxy/CDN variants ProductImage picks are sized for
          tiles; here the shopper explicitly asked to inspect detail, so load
          the original at full resolution. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          maxWidth: '96vw', maxHeight: '92vh', objectFit: 'contain',
          transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`,
          transition: gesturing ? 'none' : 'transform 160ms ease-out',
          userSelect: 'none',
        }}
      />
      <button
        type="button"
        aria-label="Close zoomed view"
        onClick={onClose}
        style={{
          position: 'fixed', top: 'calc(12px + env(safe-area-inset-top, 0px))', right: 12,
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(255,255,255,0.14)', color: '#fff',
          border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
      <div aria-hidden="true" style={{
        position: 'fixed', bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', left: 0, right: 0,
        textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', pointerEvents: 'none',
      }}>
        Pinch or double-tap to zoom
      </div>
    </div>
  );
}
