'use client';

import { useEffect, useRef, useState } from 'react';
import { NewsletterSignup } from './NewsletterSignup';
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from '@/lib/hooks/useBodyScrollLock';
import { readConsent } from '@/lib/consent';
import { WELCOME_DISCOUNT_PCT } from '@/lib/commerce';

// Newsletter capture. Desktop: modal on exit-intent or a 60s timed fallback.
// Phones (< 720px): a modal popping over a small screen is too disruptive,
// but hiding the welcome-discount offer entirely meant ~80% of traffic never
// saw it — so mobile gets a slim, dismissible bottom banner (after 25s)
// whose "Get my code" tap opens the same modal. Same dismissal memory.
//
// Dismissal is remembered for 30 days in localStorage so we don't pester
// visitors. We also suppress entirely if the visitor:
//   • Already subscribed (yp_newsletter_signed_up)
//   • Has explicitly rejected marketing cookies
//   • Is on an admin / checkout / auth page
//
// Mounted once in src/app/layout.tsx so it's available globally; component
// no-ops if any suppression rule triggers.

const DISMISS_KEY     = 'yp_newsletter_dismissed_at';
const SIGNED_UP_KEY   = 'yp_newsletter_signed_up';
const DISMISS_WINDOW  = 30 * 24 * 60 * 60 * 1000; // 30 days
const TIMED_FALLBACK_MS = 60_000;
const MOBILE_BANNER_MS  = 25_000;
const MOBILE_BREAKPOINT = 720;

function shouldSuppress(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    if (window.localStorage.getItem(SIGNED_UP_KEY)) return true;
    const dismissed = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissed && Date.now() - dismissed < DISMISS_WINDOW) return true;
  } catch {}
  // Don't pop until the visitor has decided on cookies, stacking modals is rude.
  if (!readConsent()) return true;
  // Don't pop on these high-intent flows (signup/login/checkout).
  const p = window.location.pathname;
  if (p.startsWith('/checkout') || p.startsWith('/admin') || p.startsWith('/login') || p.startsWith('/forgot-password') || p.startsWith('/reset-password') || p === '/thank-you') return true;
  return false;
}

// `discountPct: null` means there is no live welcome coupon (offer coupon
// deactivated in admin) — the modal still invites signups but stops
// promising a discount code that checkout would reject.
export function NewsletterModal({ discountPct = WELCOME_DISCOUNT_PCT }: { discountPct?: number | null } = {}) {
  const [open, setOpen] = useState(false);
  const [banner, setBanner] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = () => {
    try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setOpen(false);
    setBanner(false);
  };

  useBodyScrollLock(open);
  useEscapeKey(open, close);
  useFocusTrap(open, panelRef);

  // Arm the triggers once on mount. Phones get the slim banner (a modal
  // popping over a small screen is rude); desktop keeps exit-intent + the
  // timed fallback straight into the modal.
  useEffect(() => {
    if (shouldSuppress()) return;

    if (window.innerWidth < MOBILE_BREAKPOINT) {
      const t = window.setTimeout(() => setBanner(true), MOBILE_BANNER_MS);
      return () => window.clearTimeout(t);
    }

    let armed = true;
    const onLeave = (e: MouseEvent) => {
      // Exit-intent only fires when the cursor leaves through the top edge,       // distinguishes "switching tabs" from "moving down the page".
      if (!armed) return;
      if (e.clientY <= 0) {
        armed = false;
        setOpen(true);
      }
    };
    const t = window.setTimeout(() => {
      if (armed) {
        armed = false;
        setOpen(true);
      }
    }, TIMED_FALLBACK_MS);
    document.addEventListener('mouseleave', onLeave);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  // When the embedded form succeeds, the inline NewsletterSignup swaps in a
  // success message; we close the modal a beat later and mark "signed up"
  // so we never show this visitor the modal again.
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;
    const watcher = new MutationObserver(() => {
      const ok = panel.querySelector('[role="status"]');
      if (ok) {
        try { window.localStorage.setItem(SIGNED_UP_KEY, '1'); } catch {}
        setTimeout(() => setOpen(false), 1500);
      }
    });
    watcher.observe(panel, { childList: true, subtree: true });
    return () => watcher.disconnect();
  }, [open]);

  // Mobile bottom banner — slim, dismissible, stacks above the WhatsApp FAB
  // via --fab-bottom-offset. Tapping the CTA opens the full signup modal.
  if (banner && !open) {
    return (
      <div
        role="region"
        aria-label="Welcome offer"
        style={{
          position: 'fixed', left: 12, right: 12,
          bottom: 'calc(12px + var(--fab-bottom-offset, 0px) + env(safe-area-inset-bottom, 0px))',
          zIndex: 340,
          background: 'var(--ink-900)', color: 'var(--paper)',
          borderRadius: 12, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
        }}
      >
        <span style={{ flex: 1, fontSize: '0.8125rem', lineHeight: 1.4 }}>
          {discountPct !== null
            ? <><strong style={{ fontWeight: 700 }}>{discountPct}% off</strong> your first order — join the list</>
            : 'Get the Yellow Pink edit — one thoughtful email a fortnight'}
        </span>
        <button
          type="button"
          onClick={() => { setBanner(false); setOpen(true); }}
          style={{
            flexShrink: 0, padding: '8px 14px', borderRadius: 100,
            background: 'var(--brand-pink-cta)', color: 'white', border: 'none',
            fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
          }}
        >
          {discountPct !== null ? 'Get my code' : 'Sign up'}
        </button>
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss offer"
          style={{
            flexShrink: 0, width: 32, height: 32, borderRadius: 8,
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
            fontSize: '1.125rem', lineHeight: 1, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>
      </div>
    );
  }

  if (!open) return null;

  return (
    <>
      <div
        onClick={close}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.55)',
          opacity: 1, transition: 'opacity 200ms ease-out', zIndex: 350,
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="newsletter-modal-heading"
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(440px, calc(100vw - 32px))',
          background: 'var(--paper)', borderRadius: 'var(--radius-card)',
          padding: 32, boxShadow: '0 32px 64px rgba(0,0,0,0.28)',
          zIndex: 351,
        }}
      >
        <button
          onClick={close}
          aria-label="Close newsletter signup"
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 40, height: 40, borderRadius: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--ink-500)', fontSize: '1.25rem', lineHeight: 1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>

        <div style={{ marginBottom: 16, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--brand-pink-text)' }}>
          Inside Yellow Pink
        </div>
        <h2
          id="newsletter-modal-heading"
          className="display-l"
          style={{ fontSize: '1.75rem', margin: '0 0 10px', lineHeight: 1.15 }}
        >
          {discountPct !== null ? `${discountPct}% off your first order` : 'Get the Yellow Pink edit'}
        </h2>
        <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 20, fontSize: '0.9375rem' }}>
          {discountPct !== null
            ? 'Sign up and we’ll send a welcome code, plus one thoughtful email a fortnight, new arrivals, restocks, and Pakistan-specific routine tips.'
            : 'One thoughtful email a fortnight, new arrivals, restocks, and Pakistan-specific routine tips.'}
        </p>
        <NewsletterSignup source="modal" variant="light" ctaLabel="Sign up" />
        <p style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--ink-500)' }}>
          Unsubscribe any time. We never share your email.
        </p>
      </div>
    </>
  );
}
