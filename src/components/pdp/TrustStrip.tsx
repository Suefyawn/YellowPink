// Always-on trust strip for the PDP buy panel. A new store with no reviews on
// most products converts cold traffic poorly, this scannable row answers the
// three silent objections a first-time Pakistani shopper has at the add-to-cart
// moment: "is it genuine?", "do I have to pay before I get it?", and "what if
// it's wrong?". Lucide-style inline SVGs (24x24, currentColor) per AGENTS.md,
// no emoji icons.

const items: { label: string; sub: string; icon: React.ReactNode }[] = [
  {
    label: '100% Authentic',
    sub: 'Genuine brands only',
    icon: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
  {
    label: 'Cash on Delivery',
    sub: 'Pay when it arrives',
    icon: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <circle cx="12" cy="12" r="3" />
        <path d="M6 12h.01M18 12h.01" />
      </>
    ),
  },
  {
    label: 'Easy Returns',
    sub: '7-day return window',
    icon: (
      <>
        <path d="M3 7v6h6" />
        <path d="M3.5 13a9 9 0 1 0 2.1-9.4L3 7" />
      </>
    ),
  },
  {
    label: 'Fast Delivery',
    sub: 'Nationwide, 2 to 5 days',
    icon: (
      <>
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
        <path d="M15 18H9" />
        <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
        <circle cx="17" cy="18" r="2" />
        <circle cx="7" cy="18" r="2" />
      </>
    ),
  },
];

export function TrustStrip() {
  return (
    <ul
      aria-label="Why shop with Yellow Pink"
      style={{
        listStyle: 'none', padding: 0, margin: '0 0 24px',
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10,
      }}
    >
      {items.map(it => (
        <li
          key={it.label}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', background: 'var(--paper2, #faf6ee)',
            border: '1px solid var(--line)', borderRadius: 10,
          }}
        >
          <svg
            width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="var(--brand-pink-text, #9d174d)" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            {it.icon}
          </svg>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-900)', lineHeight: 1.2 }}>{it.label}</span>
            <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--ink-500)', lineHeight: 1.3 }}>{it.sub}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
