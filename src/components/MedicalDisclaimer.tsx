// Medical/health disclaimer — a YMYL (Your Money or Your Life) safeguard shown
// on supplement product pages and health/wellness journal posts. Required-bar
// content for a health store: it keeps editorial and product copy compliant
// with search-engine quality policies and sets honest expectations for readers.
//
// Two variants:
//   • "editorial" — for blog/journal articles (educational, not advice).
//   • "product"   — for supplement PDPs (food supplement, not a medicine).
// Render it only for health categories — see isHealthCategory() in
// lib/category-taxonomy. Beauty/cosmetic pages must not show it.

const COPY: Record<'editorial' | 'product', string> = {
  editorial:
    'This article is for general educational purposes only and is not medical advice. ' +
    'It is not intended to diagnose, treat, cure, or prevent any disease. Supplements affect ' +
    'everyone differently — always consult a qualified doctor or pharmacist before starting any ' +
    'supplement or changing your health routine, especially if you are pregnant, breastfeeding, ' +
    'taking medication, or managing a medical condition.',
  product:
    'Food supplement — not a medicine. This product is not intended to diagnose, treat, cure, or ' +
    'prevent any disease, and these statements have not been evaluated by a medicines regulatory ' +
    'authority. Do not exceed the recommended daily dose. Consult a qualified doctor or pharmacist ' +
    'before use if you are pregnant, breastfeeding, taking medication, or managing a health ' +
    'condition. Keep out of reach of children.',
};

export function MedicalDisclaimer({
  variant = 'editorial',
}: {
  variant?: 'editorial' | 'product';
}) {
  return (
    <aside
      role="note"
      aria-label="Health disclaimer"
      style={{
        marginTop: 24,
        padding: '14px 16px',
        borderRadius: 10,
        border: '1px solid var(--line)',
        background: 'var(--surface-2, #faf7f2)',
      }}
    >
      <strong
        style={{
          display: 'block',
          fontFamily: 'var(--font-ui)',
          fontSize: '0.6875rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ink-900)',
          marginBottom: 6,
        }}
      >
        Health disclaimer
      </strong>
      <p
        className="small-text"
        style={{ color: 'var(--ink-500)', fontSize: '0.75rem', lineHeight: 1.55, margin: 0 }}
      >
        {COPY[variant]}
      </p>
    </aside>
  );
}
