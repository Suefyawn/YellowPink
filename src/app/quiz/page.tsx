import type { Metadata } from 'next';
import { pageMeta, jsonLd, breadcrumbLd } from '@/lib/seo';
import { Overline } from '@/components/ui/Overline';
import { QuizClient } from '@/components/quiz/QuizClient';

export function generateMetadata(): Metadata {
  return pageMeta({
    title: 'Find your match, skincare & wellness quiz',
    description:
      'Take our quick quiz and get personalised skincare and wellness product recommendations, with cash-on-delivery across Pakistan.',
    path: '/quiz',
  });
}

export default function QuizPage() {
  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Find your match', path: '/quiz' },
        ])) }}
      />
      <section style={{ padding: '56px var(--side)' }}>
        <div className="container" style={{ maxWidth: 800, margin: '0 auto' }}>
          <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Find your match</Overline>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, margin: '0 0 28px' }}>
            What does your routine need?
          </h1>
          <QuizClient />
        </div>
      </section>
    </main>
  );
}
