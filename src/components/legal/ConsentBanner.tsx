'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { readConsent, writeConsent, acceptAll, rejectAll } from '@/lib/consent';

// Bottom-left consent prompt shown until the user makes a choice. We keep
// it small + dismissible (no full-screen modal blocking the page) so first
// impressions aren't ruined by a compliance wall. Once a choice is recorded
// it never reappears unless the user resets from /privacy.
//
// Mounted once in src/app/layout.tsx so it's available on every route.

const ESCAPE_DELAY_MS = 600;

export function ConsentBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  // Mount-time gate so we don't render the banner during SSR, the consent
  // state lives in document.cookie (external), and only the client side
  // knows whether to surface the banner.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    // Wait a beat so we don't compete with the page load animation.
    const t = setTimeout(() => {
      if (!readConsent()) setVisible(true);
    }, ESCAPE_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // Staff-only surface: the admin panel drops no analytics/marketing cookies
  // (staff traffic is flagged internal), and the storefront banner floating
  // over the admin UI was pure noise. Staff still see it on the storefront.
  if (pathname?.startsWith('/admin')) return null;

  // Checkout is the one page where nothing may compete with the form: the
  // banner appears on a delay and covered the address fields mid-typing on
  // phones (390px conversion audit, 2026-07-19). Deferring the PROMPT here
  // costs nothing — pre-consent, analytics/marketing cookies stay off anyway
  // — and the shopper sees it on the next non-checkout page instead.
  if (pathname?.startsWith('/checkout')) return null;

  if (!mounted || !visible) return null;

  const handleAccept = () => { acceptAll(); setVisible(false); };
  const handleReject = () => { rejectAll(); setVisible(false); };
  const handleSave   = () => { writeConsent({ analytics, marketing }); setVisible(false); };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie preferences"
      className="consent-banner"
      style={{
        position: 'fixed',
        background: 'var(--paper)',
        zIndex: 400,
        fontFamily: 'var(--font-ui)',
      }}
    >
      {/* Docked flush to the viewport's bottom edge: a full-width bottom bar
          on mobile (no floating card covering the hero CTAs), a modest
          bottom-right card on desktop. Positional styles live in this class
          (not inline) because the split needs a media query.

          --fab-bottom-offset is set by the PDP's sticky buy bar while it's
          visible (same mechanism the WhatsApp FAB and BackToTop use). Without
          it, this banner (z 400) painted directly over the buy bar (z 90) —
          every first-time visitor landing on a product page from a social
          link had the price and Add-to-Cart covered until they answered the
          cookie prompt. Now the banner stacks ABOVE the buy bar instead. */}
      <style>{`
        .consent-banner {
          left: 0; right: 0;
          bottom: var(--fab-bottom-offset, 0px);
          border-top: 1px solid var(--line);
          box-shadow: 0 -10px 30px rgba(0,0,0,0.12);
          padding: 16px var(--side) calc(16px + env(safe-area-inset-bottom, 0px));
        }
        @media (min-width: 769px) {
          .consent-banner {
            left: auto; right: 20px;
            bottom: calc(20px + var(--fab-bottom-offset, 0px));
            width: min(420px, calc(100vw - 40px));
            border: 1px solid var(--line);
            border-radius: var(--radius-card);
            box-shadow: 0 18px 48px rgba(0,0,0,0.18);
            padding: 20px;
          }
        }
      `}</style>
      <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--ink-900)' }}>
        Cookies on Yellow Pink
      </h2>
      <p style={{ margin: '6px 0 14px', fontSize: '0.8125rem', lineHeight: 1.5, color: 'var(--ink-700)' }}>
        We use essential cookies for cart + checkout. With your permission we also use analytics
        cookies to understand which pages help shoppers and marketing cookies for retargeting.{' '}
        <Link href="/privacy" className="underline" style={{ color: 'var(--ink-900)' }}>
          Privacy & cookie policy
        </Link>
        .
      </p>

      {expanded && (
        <div style={{ marginBottom: 14, padding: 12, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--paper2)' }}>
          <Row label="Essential" description="Required for cart, checkout, login. Cannot be disabled." disabled checked />
          <Row label="Analytics" description="Helps us see which pages convert (no PII)." checked={analytics} onChange={setAnalytics} />
          <Row label="Marketing" description="Used to retarget you with relevant ads." checked={marketing} onChange={setMarketing} />
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button
          onClick={handleAccept}
          className="btn-primary"
          style={{ padding: '10px 18px', fontSize: '0.75rem', minHeight: 40 }}
        >
          Accept all
        </button>
        <button
          onClick={expanded ? handleSave : handleReject}
          style={{
            background: 'none', border: '1px solid var(--ink-900)', cursor: 'pointer',
            padding: '10px 16px', borderRadius: 'var(--radius-card)',
            fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 600,
            letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-900)',
            minHeight: 40,
          }}
        >
          {expanded ? 'Save choices' : 'Reject non-essential'}
        </button>
        <button
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 8px', color: 'var(--ink-700)', fontFamily: 'var(--font-ui)',
            fontSize: '0.75rem', fontWeight: 500, textDecoration: 'underline',
            textUnderlineOffset: 2,
          }}
        >
          {expanded ? 'Hide options' : 'Customise'}
        </button>
      </div>
    </div>
  );
}

function Row({ label, description, checked, onChange, disabled }: {
  label: string; description: string; checked: boolean;
  onChange?: (v: boolean) => void; disabled?: boolean;
}) {
  const id = `consent-${label.toLowerCase()}`;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0' }}>
      <input
        id={id} type="checkbox" checked={checked} disabled={disabled}
        onChange={e => onChange?.(e.target.checked)}
        style={{ marginTop: 3, accentColor: 'var(--brand-pink)' }}
      />
      <label htmlFor={id} style={{ flex: 1, cursor: disabled ? 'default' : 'pointer' }}>
        <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--ink-900)' }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--ink-700)', lineHeight: 1.4 }}>{description}</div>
      </label>
    </div>
  );
}
