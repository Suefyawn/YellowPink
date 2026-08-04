import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMeta, jsonLd, breadcrumbLd } from '@/lib/seo';
import { Overline } from '@/components/ui/Overline';
import { DueDateCalculator } from '@/components/tools/DueDateCalculator';

export function generateMetadata(): Metadata {
  return pageMeta({
    title: 'Pregnancy Calculator: Due Date, Week & Trimester',
    description:
      'Free pregnancy due date calculator. Enter your last period date to see when your baby is due, how many weeks pregnant you are today, your trimester, and your scan dates.',
    path: '/pregnancy-calculator',
  });
}

export default function PregnancyCalculatorPage() {
  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Free Tools', path: '/tools' },
          { name: 'Pregnancy Calculator', path: '/pregnancy-calculator' },
        ])) }}
      />
      <section style={{ padding: '56px var(--side) 0' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto' }}>
          <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Free tool · Nothing leaves your browser</Overline>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, margin: '0 0 12px' }}>
            Pregnancy Calculator
          </h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: '0 0 28px' }}>
            Enter the first day of your last period and see your due date, how far along you are today,
            and the dates that matter this pregnancy: your trimesters and your ultrasound windows.
          </p>
          <DueDateCalculator />
        </div>
      </section>

      <section style={{ padding: '40px var(--side) var(--section-gap)' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 500, margin: '8px 0 0' }}>How your due date is worked out</h2>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>
            Doctors count pregnancy from the first day of your last period, not from the day you conceived,
            because most women know that date. A full pregnancy is about 40 weeks from there, adjusted for
            your own cycle length. That is why the calculator may say you are &quot;4 weeks pregnant&quot; when
            conception was only two weeks ago; your doctor counts the same way, so the numbers will match at
            your first appointment. The first ultrasound may fine-tune the date by a few days, and that
            scan date wins.
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 500, margin: '8px 0 0' }}>What to do first</h2>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>
            Two things matter more in early pregnancy than anything else you can buy or plan. Start folic
            acid the day you find out, if you are not already taking it; it protects your baby&apos;s brain and
            spine development in exactly these first weeks, and our{' '}
            <Link href="/blog/folic-acid-tablets-benefits-dosage-pakistan" className="text-link">folic acid guide</Link> explains
            the dose. And book your first antenatal visit for around week 6 to 8. If you want the essentials
            in one order, the{' '}
            <Link href="/product/pregnancy-prenatal-care-combo-pack-complete-maternal-health-bundle" className="text-link">prenatal care combo</Link>{' '}
            covers them with cash on delivery anywhere in Pakistan.
          </p>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>
            Not sure if you are pregnant yet? Our{' '}
            <Link href="/blog/early-pregnancy-symptoms-pakistan" className="text-link">early pregnancy symptoms guide</Link> walks
            through the first signs and when a home test becomes reliable. Still trying? The{' '}
            <Link href="/ovulation-calculator" className="text-link">ovulation calculator</Link> shows your best days each month.
          </p>
          <p className="small-text" style={{ color: 'var(--ink-500)', margin: 0 }}>
            This tool gives general estimates for education and does not replace antenatal care. See a doctor
            promptly for bleeding, sharp one-sided pain, or severe vomiting.
          </p>
        </div>
      </section>
    </main>
  );
}
