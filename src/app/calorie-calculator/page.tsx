import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMeta, jsonLd, breadcrumbLd, faqLd } from '@/lib/seo';
import { AnswerHero } from '@/components/tools/AnswerHero';
import { CalorieCalculator } from '@/components/tools/CalorieCalculator';

// FAQ copy doubles as FAQPage structured data; questions carry this page's
// Semrush long-tail (bmr calculator, tdee calculator, calorie deficit).
const FAQS = [
  {
    question: 'How many calories should I eat a day?',
    answer: 'It depends on your size, age, sex and activity, which is what the calculator above works out. As a rough anchor, most Pakistani women maintain on 1,800 to 2,200 kcal and most men on 2,200 to 2,800 kcal.',
  },
  {
    question: 'What is BMR?',
    answer: 'BMR (basal metabolic rate) is what your body burns at complete rest, just keeping you alive. This calculator uses the Mifflin-St Jeor equation, the formula dietitians consider the most accurate from basic measurements.',
  },
  {
    question: 'What is TDEE?',
    answer: 'TDEE (total daily energy expenditure) is your BMR multiplied by how active you are; the "maintenance" number above is your TDEE. Eat below it and you lose weight, above it and you gain.',
  },
  {
    question: 'How big should a calorie deficit be?',
    answer: 'About 500 kcal below maintenance loses roughly half a kilo a week, which research shows is far more sustainable than crash dieting. Never go below 1,200 kcal a day without medical supervision.',
  },
];

export function generateMetadata(): Metadata {
  return pageMeta({
    title: 'Calorie Calculator: Daily Needs, BMR & Protein',
    description:
      'Free calorie calculator for Pakistan. Get your daily maintenance calories, a realistic target for losing or gaining weight, your BMR, and how much protein you need each day.',
    path: '/calorie-calculator',
  });
}

export default function CalorieCalculatorPage() {
  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Quick Answers', path: '/answers' },
          { name: 'Calorie Calculator', path: '/calorie-calculator' },
        ])) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqLd(FAQS)) }} />
      <AnswerHero
        href="/calorie-calculator"
        title="Calorie Calculator"
        intro="Answer five quick questions and get your daily calorie needs: how much keeps your weight steady, what to eat to lose or gain at a healthy pace, and your daily protein target."
      />
      <section style={{ padding: '0 var(--side)' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto' }}>
          <CalorieCalculator />
        </div>
      </section>

      <section style={{ padding: '40px var(--side) var(--section-gap)' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 500, margin: '8px 0 0' }}>How to read your numbers</h2>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>
            Maintenance is what your body burns in a normal day, so eating around it keeps your weight where
            it is. The losing target sits about 500 kcal below that, which comes to roughly half a kilo a
            week; slower than a crash diet, and far more likely to stay off. The gaining target adds a modest
            surplus so the extra goes toward muscle rather than straight to fat. Whichever direction you
            pick, weigh yourself weekly at the same time of day and judge by the two-week trend, not any
            single morning.
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 500, margin: '8px 0 0' }}>The protein number matters most</h2>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>
            Most Pakistani diets are heavy on roti and rice and light on protein, and protein is what keeps
            you full, protects muscle while losing weight, and builds it while gaining. Daal, eggs, chicken,
            yogurt and beef cover most of the target; if you train and struggle to reach your number from
            food alone, our <Link href="/blog/protein-supplements-men-pakistan-muscle-building" className="text-link">protein guide</Link>{' '}
            explains when a whey shake earns its place and when it is wasted money.
          </p>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>
            Wondering where your weight stands in the first place? The{' '}
            <Link href="/bmi-calculator" className="text-link">BMI calculator</Link> takes ten seconds and uses the South Asian
            ranges that apply here. And if you want the burn side of the equation on its own, the{' '}
            <Link href="/tdee-calculator" className="text-link">TDEE calculator</Link> breaks down the maintenance number this
            page starts from, with targets at every pace.
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
            and are for healthy adults. If you have diabetes, thyroid disease, or are pregnant or
            breastfeeding, set targets with your doctor instead.
          </p>
        </div>
      </section>
    </main>
  );
}
