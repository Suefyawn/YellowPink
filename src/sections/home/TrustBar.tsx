'use client';

// Trust strip under the hero. Line icons match the Feather-style set used
// across the header / mini-cart so the row reads as part of one system.
//
// The delivery + returns lines read the live owner settings (free-shipping
// threshold / on-off, and the returns window) instead of hard-coding the
// figures, so the strip can never drift from the cart, checkout or PDP.

import { useCommerceSettings } from '@/context/CommerceSettings';
import { RETURNS_WINDOW_DAYS, freeShippingShort } from '@/lib/commerce';

type IconName = 'authentic' | 'delivery' | 'cod' | 'returns';

function TrustIcon({ name }: { name: IconName }) {
  const p = {
    width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.75,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'authentic': // shield + check, genuine / verified
      return <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>;
    case 'delivery': // delivery van
      return <svg {...p}><rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>;
    case 'cod': // banknote, cash on delivery
      return <svg {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01" /><path d="M18 12h.01" /></svg>;
    case 'returns': // counter-clockwise arrow, returns
      return <svg {...p}><path d="M3 12a9 9 0 1 0 2.7-6.4" /><path d="M3 4v5h5" /></svg>;
  }
}

export function TrustBar() {
  const commerce = useCommerceSettings();

  // Delivery line tracks the live free-shipping setting (threshold + on/off);
  // returns line tracks the single returns-window source. If the owner switches
  // free shipping off, the slot is dropped rather than showing an empty promise.
  const ITEMS: { icon: IconName; label: string; sub: string }[] = [
    { icon: 'authentic', label: '100% Authentic', sub: 'Imported directly' },
    ...(commerce.freeShippingEnabled
      ? [{ icon: 'delivery' as IconName, label: 'Free Delivery', sub: freeShippingShort(commerce) }]
      : []),
    { icon: 'cod', label: 'COD Nationwide', sub: 'Pay on delivery' },
    { icon: 'returns', label: 'Easy Returns', sub: `${RETURNS_WINDOW_DAYS}-day policy` },
  ];

  return (
    <section style={{ padding: '32px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
      <div className="container trust-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)', textAlign: 'center' }}>
        {ITEMS.map((it) => (
          <div key={it.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span
              aria-hidden="true"
              style={{
                width: 44, height: 44, marginBottom: 10, borderRadius: '50%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--paper2)', color: 'var(--brand-pink-text)',
              }}
            >
              <TrustIcon name={it.icon} />
            </span>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 2 }}>{it.label}</div>
            <div className="small-text">{it.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
