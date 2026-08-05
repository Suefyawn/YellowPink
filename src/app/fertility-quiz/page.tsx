import type { Metadata } from 'next';
import { pageMeta, jsonLd, breadcrumbLd, faqLd } from '@/lib/seo';
import { AnswerHero } from '@/components/tools/AnswerHero';
import { FertilityQuiz } from '@/components/tools/FertilityQuiz';

// FAQ copy doubles as FAQPage structured data.
const FAQS = [
  {
    question: 'How soon should we see a doctor about fertility?',
    answer: 'After a year of regular trying, or after six months if you are 35 or older, have very irregular cycles, or have a known condition like endometriosis or PCOS. Seeing a doctor sooner never hurts.',
  },
  {
    question: 'Is infertility usually the woman’s issue?',
    answer: 'No. Across studies roughly a third of cases trace to the female side, a third to the male side, and a third to both or unexplained causes. A semen analysis is a simple, inexpensive first test for the male side.',
  },
  {
    question: 'Can supplements really help fertility?',
    answer: 'They support specific, identified problems: myo-inositol has good evidence for restoring ovulation in PCOS, and antioxidant blends can improve sperm parameters over about three months. None replace finding the actual cause.',
  },
];

export function generateMetadata(): Metadata {
  return pageMeta({
    title: 'Fertility Quiz: What Should You Check First?',
    description:
      'Free 4-question fertility quiz for couples in Pakistan. Your answer pattern points to the most useful next step: timing, hormonal checks, the male side, or a full fertility workup.',
    path: '/fertility-quiz',
  });
}

export default function FertilityQuizPage() {
  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Quick Answers', path: '/answers' },
          { name: 'Fertility Quiz', path: '/fertility-quiz' },
        ])) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqLd(FAQS)) }} />
      <AnswerHero
        href="/fertility-quiz"
        title="Fertility Quiz"
        intro="Four questions, no personal details, and your answer pattern points to the single most useful next step: better timing, a hormonal check, the male side, or a proper fertility workup."
      />
      <section style={{ padding: '0 var(--side) var(--section-gap)' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto' }}>
          <FertilityQuiz />
        </div>
      </section>
    </main>
  );
}
