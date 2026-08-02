// Independence Day announcement bar: Pakistan-green strip with a crescent
// and star, the sale message, and the coupon code in a small pill. Rendered
// by SiteChrome in place of the normal announcement bar while the seasonal
// theme window (Admin → Settings → Homepage) is open.

function CrescentStar({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={{ flexShrink: 0 }}
    >
      {/* Crescent: a moon arc open to the right, star beside it. */}
      <path d="M14 3a9 9 0 1 0 0 18 7.5 7.5 0 0 1 0-18z" />
      <path d="M17.5 9.5l.9 1.82 2 .29-1.45 1.42.34 2-1.79-.94-1.79.94.34-2-1.45-1.42 2-.29z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SeasonalBar({ message, compactMessage, coupon, bgColor, textColor }: {
  message: string;
  compactMessage: string;
  coupon: string | null;
  bgColor: string;
  textColor: string;
}) {
  const pill = coupon ? (
    <span style={{
      display: 'inline-block', marginLeft: 8, padding: '1px 8px',
      border: '1px solid rgba(255,255,255,0.55)', borderRadius: 999,
      fontWeight: 700, letterSpacing: '0.08em',
    }}>{coupon}</span>
  ) : null;
  return (
    <div style={{
      background: bgColor,
      color: textColor,
      padding: '10px 12px',
      textAlign: 'center',
      fontFamily: 'var(--font-ui)',
      fontSize: '0.75rem',
      fontWeight: 500,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      <CrescentStar />
      <span className="announcement-full">{message}{pill}</span>
      <span className="announcement-compact">{compactMessage}</span>
      <CrescentStar />
    </div>
  );
}
