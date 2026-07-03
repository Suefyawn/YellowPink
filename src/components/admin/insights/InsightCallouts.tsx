// Stripe-style "what stands out" strip: a short list of computed, plain-
// language observations above a tab's charts, so the numbers come with their
// own reading. Callers pass ready sentences (computed server-side from real
// window data); the component renders nothing when there's nothing to say.
export function InsightCallouts({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{
      background: 'white', border: '1px solid #eef0f2', borderRadius: 12,
      padding: '14px 18px', marginBottom: 24, boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {items.map((text, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C5286A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
            <path d="M9 18h6" /><path d="M10 22h4" />
          </svg>
          <span style={{ fontSize: '0.8125rem', color: '#374151', lineHeight: 1.5 }}>{text}</span>
        </div>
      ))}
    </div>
  );
}
