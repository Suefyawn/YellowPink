import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMeta, jsonLd, breadcrumbLd } from '@/lib/seo';
import { Overline } from '@/components/ui/Overline';
import { OvulationCalculator } from '@/components/tools/OvulationCalculator';

export function generateMetadata(): Metadata {
  return pageMeta({
    title: 'Ovulation Calculator: Find Your Fertile Days',
    description:
      'Free ovulation calculator for Pakistan. Enter your last period date and cycle length to see your fertile window, ovulation day, next period date and when a pregnancy test becomes reliable.',
    path: '/ovulation-calculator',
  });
}

export default function OvulationCalculatorPage() {
  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Ovulation Calculator', path: '/ovulation-calculator' },
        ])) }}
      />
      <section style={{ padding: '56px var(--side) 0' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto' }}>
          <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Free tool · Nothing leaves your browser</Overline>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, margin: '0 0 12px' }}>
            Ovulation Calculator
          </h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: '0 0 28px' }}>
            Enter the first day of your last period and your usual cycle length. The calculator shows your
            fertile window, your most likely ovulation day, and the earliest date a pregnancy test is reliable.
          </p>
          <OvulationCalculator />
        </div>
      </section>

      <section style={{ padding: '40px var(--side) var(--section-gap)' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 500, margin: '8px 0 0' }}>How the calculator works</h2>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>
            Ovulation happens about 14 days before the <em>next</em> period starts, not 14 days after the last one,
            which is why cycle length matters. The egg lives about 24 hours, but sperm survive up to five days,
            so the fertile window runs from five days before ovulation to the day after it. Couples who time
            intimacy inside that window every cycle have the best monthly odds of conceiving.
          </p>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>
            A calendar estimate is a starting point, not a guarantee. If your cycles swing by more than a few
            days, pair the dates with your body&apos;s own signals, cervical mucus and ovulation pain, explained in our{' '}
            <Link href="/blog/ovulation-signs-timing-conceive-pakistan" className="text-link">ovulation signs guide</Link>. Cycles that are
            unpredictable month to month are worth reading about in our{' '}
            <Link href="/blog/irregular-periods-causes-and-treatment-pakistan" className="text-link">irregular periods guide</Link>, since
            conditions like PCOS shift ovulation or stop it entirely.
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 500, margin: '8px 0 0' }}>Trying to conceive?</h2>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>
            Timing is half the work; the other half is the three months of preparation both partners bring to the
            fertile window. Our <Link href="/blog/how-to-get-pregnant-trying-to-conceive-pakistan" className="text-link">trying-to-conceive guide</Link>{' '}
            covers the habits with real evidence, folic acid before conception is the non-negotiable (see the{' '}
            <Link href="/blog/folic-acid-tablets-benefits-dosage-pakistan" className="text-link">folic acid guide</Link>), and the{' '}
            <Link href="/product/couples-conceive-pack" className="text-link">Trying-to-Conceive Couple&apos;s Pack</Link> covers
            both of you in one order, delivered anywhere in Pakistan with cash on delivery.
          </p>
          <p className="small-text" style={{ color: 'var(--ink-500)', margin: 0 }}>
            This tool provides general estimates for education and does not replace medical advice. If you have
            been trying for over a year (or six months past age 35), our{' '}
            <Link href="/blog/infertility-causes-ivf-pakistan-guide" className="text-link">infertility guide</Link> explains when and where to
            get help.
          </p>
        </div>
      </section>
    </main>
  );
}
