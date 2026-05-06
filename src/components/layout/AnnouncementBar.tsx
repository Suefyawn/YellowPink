export function AnnouncementBar() {
  return (
    <div style={{
      background: 'var(--ink-900)', color: 'var(--paper)',
      padding: '10px 0', textAlign: 'center',
      fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 500,
      letterSpacing: '0.06em', textTransform: 'uppercase',
    }}>
      <span>Free delivery on orders over </span>
      <span style={{ borderBottom: '2px solid var(--brand-yellow)', paddingBottom: 1 }}>PKR 2,500</span>
      <span> — COD Nationwide</span>
    </div>
  );
}
