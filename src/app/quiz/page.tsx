import type { Metadata } from 'next';
import { pageMeta, jsonLd, breadcrumbLd } from '@/lib/seo';
import { Overline } from '@/components/ui/Overline';
import { QuizClient } from '@/components/quiz/QuizClient';

export function generateMetadata(): Metadata {
  return pageMeta({
    title: 'Routine Finder, build your skincare or wellness plan',
    description:
      'Answer two quick questions and get a step-by-step skincare routine or supplement plan matched to you, saved to a link you can share. Cash on delivery across Pakistan.',
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
      {/* minHeight so the intro screen owns the viewport instead of the
          footer dominating a short page. */}
      <section style={{ padding: '56px var(--side)', minHeight: '60vh' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto' }}>
          <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Routine Finder · Two questions · Saved to a shareable link</Overline>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, margin: '0 0 28px' }}>
            What does your routine need?
          </h1>
          <QuizClient />
        </div>
      </section>
    </main>
  );
}
