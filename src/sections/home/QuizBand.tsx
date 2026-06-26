import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';

// Homepage entry point for the product-finder quiz (/quiz). A distinct band so
// it stands out from the product rails, the quiz is an engagement + lead-gen
// driver, so it earns a prominent, single-purpose CTA.
export function QuizBand() {
  return (
    <section style={{ paddingBottom: 'var(--section-gap)' }}>
      <div className="container">
        <div
          style={{
            borderRadius: 'var(--radius-card)',
            background: 'linear-gradient(120deg, #fdf2f6 0%, #f7eef9 55%, #eef3ec 100%)',
            border: '1px solid var(--line)',
            padding: 'clamp(28px, 5vw, 52px)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
          }}
        >
          <div style={{ maxWidth: 520 }}>
            <Overline style={{ display: 'block', marginBottom: 10, color: 'var(--ink-500)' }}>Find your match</Overline>
            <h2 className="display-l" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', marginBottom: 12 }}>
              Not sure where to start?
            </h2>
            <p className="body-text" style={{ color: 'var(--ink-700)', lineHeight: 1.6, margin: 0 }}>
              Take our 30-second quiz and get skincare or wellness picks chosen for you,               plus a welcome discount when you save your results.
            </p>
          </div>
          <Link
            href="/quiz"
            className="btn-primary"
            style={{ padding: '14px 30px', fontSize: '1rem', whiteSpace: 'nowrap' }}
          >
            Take the quiz →
          </Link>
        </div>
      </div>
    </section>
  );
}
