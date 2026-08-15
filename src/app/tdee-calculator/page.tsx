import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMeta, jsonLd, breadcrumbLd, faqLd } from '@/lib/seo';
import { AnswerHero } from '@/components/tools/AnswerHero';
import { TdeeCalculator } from '@/components/tools/TdeeCalculator';

// FAQ copy doubles as FAQPage structured data; questions carry this page's
// long-tail (what is tdee, tdee vs bmr, activity level, calorie deficit).
const FAQS = [
  {
    question: 'What is TDEE?',
    answer: 'TDEE (total daily energy expenditure) is every calorie your body burns in 24 hours: keeping you alive, walking, working, exercising, even digesting food. It is your BMR multiplied by an activity factor between 1.2 and 1.9.',
  },
  {
    question: 'What is the difference between TDEE and BMR?',
    answer: 'BMR is what you burn lying completely still; TDEE adds everything you do on top of that. For most people TDEE runs 20 to 90 percent higher than BMR, which is why eating at your BMR alone is too little for daily life.',
  },
  {
    question: 'Which activity level should I choose?',
    answer: 'Most people overestimate. If you have a desk job and no regular exercise, pick "mostly sitting" even when your days feel busy. Count only real, repeated exercise; the top two levels are for people who train most days of the week or do physical work.',
  },
  {
    question: 'How far below my TDEE should I eat to lose weight?',
    answer: 'About 250 kcal below is a gentle cut of roughly a quarter kilo a week; 500 kcal below loses about half a kilo a week. Bigger deficits backfire for most people, and no one should eat under 1,200 kcal a day without medical supervision.',
  },
];

export function generateMetadata(): Metadata {
  return pageMeta({
    title: 'TDEE Calculator: Total Daily Energy Burn',
    description:
      'Free TDEE calculator for Pakistan. Get your total daily energy expenditure from your age, height, weight and activity level, plus calorie targets for losing or gaining weight.',
    path: '/tdee-calculator',
  });
}

export default function TdeeCalculatorPage() {
  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Quick Answers', path: '/answers' },
          { name: 'TDEE Calculator', path: '/tdee-calculator' },
        ])) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqLd(FAQS)) }} />
      <AnswerHero
        href="/tdee-calculator"
        title="TDEE Calculator"
        intro="Answer five quick questions to see how many calories your body burns in a full day, then use the targets table to eat for steady loss, maintenance or gain."
      />
      <section style={{ padding: '0 var(--side)' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto' }}>
          <TdeeCalculator />
        </div>
      </section>

      <section style={{ padding: '40px var(--side) var(--section-gap)' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 500, margin: '8px 0 0' }}>What TDEE actually measures</h2>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>
            Your body burns calories all day, and TDEE is the total. It starts from your BMR, the energy
            spent just keeping you alive at complete rest, worked out here with the Mifflin-St Jeor
            equation. Everything you do on top of that (walking to the bazaar, housework, your job, any
            workouts) gets folded in through the activity multiplier you picked. The result is the number
            of calories that keeps your weight exactly where it is.
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 500, margin: '8px 0 0' }}>How to use the number</h2>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>
            Treat your TDEE as the line on the scale: eat below it and you lose weight, above it and you
            gain. The table above turns that into practical targets. A 250 kcal change is gentle and easy
            to live with; 500 kcal moves you about half a kilo a week, which research shows is the pace
            people actually sustain. Whichever target you pick, weigh yourself weekly at the same time of
            day and judge by the two-week trend, then adjust the target if the scale is not moving the way
            you want.
          </p>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>
            Want the fuller picture around that target? The{' '}
            <Link href="/calorie-calculator" className="text-link">calorie calculator</Link> adds a daily protein figure to the
            same numbers, and protein is the part most Pakistani diets run short on. Not sure whether you
            should be losing or gaining in the first place? The{' '}
            <Link href="/bmi-calculator" className="text-link">BMI calculator</Link> answers that in ten seconds, using the
            South Asian ranges that apply here.
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 500, margin: '8px 0 0' }}>Common questions</h2>
          {FAQS.map(f => (
            <div key={f.question}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 6px' }}>{f.question}</h3>
              <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>{f.answer}</p>
            </div>
          ))}
          <p className="small-text" style={{ color: 'var(--ink-500)', margin: 0 }}>
            Estimates use the{' '}
            <a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noopener" className="text-link">Mifflin-St Jeor equation</a>{' '}
            and the standard activity multipliers, and are for healthy adults. If you have diabetes,
            thyroid disease, or are pregnant or breastfeeding, set targets with your doctor instead.
          </p>
        </div>
      </section>
    </main>
  );
}
