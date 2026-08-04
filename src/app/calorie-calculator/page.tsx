import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMeta, jsonLd, breadcrumbLd } from '@/lib/seo';
import { Overline } from '@/components/ui/Overline';
import { CalorieCalculator } from '@/components/tools/CalorieCalculator';

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
          { name: 'Free Tools', path: '/tools' },
          { name: 'Calorie Calculator', path: '/calorie-calculator' },
        ])) }}
      />
      <section style={{ padding: '56px var(--side) 0' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto' }}>
          <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Free tool · Nothing leaves your browser</Overline>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, margin: '0 0 12px' }}>
            Calorie Calculator
          </h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: '0 0 28px' }}>
            Answer five quick questions and get your daily calorie needs: how much keeps your weight steady,
            what to eat to lose or gain at a healthy pace, and your daily protein target.
          </p>
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
            ranges that apply here.
          </p>
          <p className="small-text" style={{ color: 'var(--ink-500)', margin: 0 }}>
            Estimates are for healthy adults. If you have diabetes, thyroid disease, or are pregnant or
            breastfeeding, set targets with your doctor instead.
          </p>
        </div>
      </section>
    </main>
  );
}
