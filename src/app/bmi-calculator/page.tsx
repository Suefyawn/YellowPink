import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMeta, jsonLd, breadcrumbLd } from '@/lib/seo';
import { Overline } from '@/components/ui/Overline';
import { BmiCalculator } from '@/components/tools/BmiCalculator';

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
          { name: 'Free Tools', path: '/tools' },
          { name: 'BMI Calculator', path: '/bmi-calculator' },
        ])) }}
      />
      <section style={{ padding: '56px var(--side) 0' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto' }}>
          <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Free tool · Nothing leaves your browser</Overline>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, margin: '0 0 12px' }}>
            BMI Calculator
          </h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: '0 0 28px' }}>
            Enter your weight and height to get your BMI and what it means, using the South Asian ranges
            that apply to Pakistani bodies, not just the international ones.
          </p>
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
          <p className="small-text" style={{ color: 'var(--ink-500)', margin: 0 }}>
            BMI is a screening estimate for adults, not a diagnosis, and it reads muscular builds as heavier
            than they are. It is not meant for children, pregnancy, or people over 65; a doctor reads those
            differently.
          </p>
        </div>
      </section>
    </main>
  );
}
