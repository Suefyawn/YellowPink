import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMeta, jsonLd, breadcrumbLd, faqLd } from '@/lib/seo';
import { AnswerHero } from '@/components/tools/AnswerHero';
import { BmiCalculator } from '@/components/tools/BmiCalculator';

// FAQ copy doubles as FAQPage structured data; questions carry this page's
// Semrush long-tail (bmi formula, how to calculate bmi, kg and feet,
// bmi calculator female/male, ideal weight).
const FAQS = [
  {
    question: 'What is the BMI formula?',
    answer: 'BMI = weight in kilograms divided by height in metres squared. For example, 65 kg at 1.62 m is 65 ÷ (1.62 × 1.62) = 24.8. The calculator above does this for you, and accepts height in feet and inches too.',
  },
  {
    question: 'Is the BMI calculation different for women and men?',
    answer: 'The formula and the cutoffs are the same for both. Women naturally carry a little more body fat at the same BMI, which is one reason BMI is a screening number rather than a diagnosis.',
  },
  {
    question: 'What is a normal BMI in Pakistan?',
    answer: 'For South Asian adults, 18.5 to 22.9 is the healthy range. Overweight starts at 23 and obesity at 27.5, earlier than the international cutoffs of 25 and 30, because health risks rise at lower BMI in our population.',
  },
  {
    question: 'What is my ideal weight for my height?',
    answer: 'The calculator shows it with your result: it is the weight range that puts your BMI between 18.5 and 22.9 for your height. Treat it as a healthy band to aim for, not a single perfect number.',
  },
];

export function generateMetadata(): Metadata {
  return pageMeta({
    title: 'BMI Calculator with South Asian Ranges',
    description:
      'Free BMI calculator built for Pakistan. Enter your weight and height to get your BMI, your category on the South Asian scale that actually applies here, and your healthy weight range.',
    path: '/bmi-calculator',
  });
}

export default function BmiCalculatorPage() {
  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Quick Answers', path: '/answers' },
          { name: 'BMI Calculator', path: '/bmi-calculator' },
        ])) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqLd(FAQS)) }} />
      <AnswerHero
        href="/bmi-calculator"
        title="BMI Calculator"
        intro="Enter your weight and height to get your BMI and what it means, using the South Asian ranges that apply to Pakistani bodies, not just the international ones."
      />
      <section style={{ padding: '0 var(--side)' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto' }}>
          <BmiCalculator />
        </div>
      </section>

      <section style={{ padding: '40px var(--side) var(--section-gap)' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 500, margin: '8px 0 0' }}>Why this calculator uses two scales</h2>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>
            Most BMI calculators use the international cutoffs, where overweight starts at 25. Research on
            South Asian populations shows our bodies carry more fat, and more of it around the organs, at the
            same BMI, so diabetes and heart risk start climbing earlier. That is why Pakistani and Indian
            health guidelines flag overweight from 23 instead. The South Asian reading is the one to act on;
            the international one is shown so you can compare with charts you see elsewhere.
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 500, margin: '8px 0 0' }}>What to do with your number</h2>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>
            If it landed above the healthy range, small sustained changes beat crash diets every time: our{' '}
            <Link href="/calorie-calculator" className="text-link">calorie calculator</Link> gives you a realistic daily target
            to start from. If it landed below, the same calculator shows the surplus that puts weight on
            steadily. And if tiredness rides along with an unexpected number in either direction, thyroid
            and vitamin deficiencies are common and testable in Pakistan; our{' '}
            <Link href="/blog/always-tired-fatigue-causes-pakistan" className="text-link">fatigue guide</Link> covers what to ask
            the lab for.
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 500, margin: '8px 0 0' }}>Common questions</h2>
          {FAQS.map(f => (
            <div key={f.question}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 6px' }}>{f.question}</h3>
              <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>{f.answer}</p>
            </div>
          ))}
          <p className="small-text" style={{ color: 'var(--ink-500)', margin: 0 }}>
            BMI is a screening estimate for adults, not a diagnosis, and it reads muscular builds as heavier
            than they are. The lower South Asian cutoffs come from the{' '}
            <a href="https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight" target="_blank" rel="noopener" className="text-link">WHO&apos;s work on obesity</a>{' '}
            and its Asian-populations consultation. It is not meant for children, pregnancy, or people over
            65; a doctor reads those differently.
          </p>
        </div>
      </section>
    </main>
  );
}
