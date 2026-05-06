const ITEMS = [
  { label: '100% Authentic', sub: 'Imported directly' },
  { label: 'Free Delivery', sub: 'Over PKR 2,500' },
  { label: 'COD Nationwide', sub: 'Pay on delivery' },
  { label: 'Easy Returns', sub: '7-day policy' },
];

export function TrustBar() {
  return (
    <section style={{ padding: '32px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
      <div className="container trust-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)', textAlign: 'center' }}>
        {ITEMS.map((it) => (
          <div key={it.label}>
            <div style={{ fontSize: '0.625rem', color: 'var(--brand-yellow)', marginBottom: 4 }}>✦</div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 2 }}>{it.label}</div>
            <div className="small-text">{it.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
