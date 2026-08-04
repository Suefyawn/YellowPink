import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMeta, jsonLd, breadcrumbLd, faqLd } from '@/lib/seo';
import { Overline } from '@/components/ui/Overline';
import { DueDateCalculator } from '@/components/tools/DueDateCalculator';

// FAQ copy doubles as FAQPage structured data; questions carry the long-tail
// searches Semrush shows for this page (pregnancy week calculator by lmp,
// edd calculator, gestational age, pregnancy weeks and months).
const FAQS = [
  {
    question: 'How many weeks pregnant am I?',
    answer: 'Count from the first day of your last period (LMP), not from conception. Enter that date above and the calculator shows your exact week and day today, which is the same gestational age your doctor will use.',
  },
  {
    question: 'What is EDD and how is the due date calculated?',
    answer: 'EDD means estimated due date. It is your last period date plus 280 days (40 weeks), adjusted for your cycle length. Only about 1 in 20 babies arrives exactly on it; most come within two weeks either side.',
  },
  {
    question: 'How do pregnancy weeks convert into months?',
    answer: 'Weeks 1 to 13 are months one to three (first trimester), weeks 14 to 27 are months four to six (second trimester), and week 28 to birth is months seven to nine (third trimester).',
  },
  {
    question: 'Is this calculator accurate if my periods are irregular?',
    answer: 'It is less precise, because ovulation date shifts. Use your best estimate, then treat the dating ultrasound at your first antenatal visit as the final answer; doctors adjust the due date from that scan.',
  },
];

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
          { name: 'Quick Answers', path: '/answers' },
          { name: 'Pregnancy Calculator', path: '/pregnancy-calculator' },
        ])) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqLd(FAQS)) }} />
      <section style={{ padding: '56px var(--side) 0' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto' }}>
          <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Due Date Finder · Free · Nothing leaves your browser</Overline>
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
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 500, margin: '8px 0 0' }}>Common questions</h2>
          {FAQS.map(f => (
            <div key={f.question}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 6px' }}>{f.question}</h3>
              <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>{f.answer}</p>
            </div>
          ))}
          <p className="small-text" style={{ color: 'var(--ink-500)', margin: 0 }}>
            This tool gives general estimates for education and does not replace antenatal care. The{' '}
            <a href="https://www.who.int/news-room/fact-sheets/detail/antenatal-care" target="_blank" rel="noopener" className="text-link">WHO recommends</a>{' '}
            starting antenatal visits in the first 12 weeks. See a doctor promptly for bleeding, sharp
            one-sided pain, or severe vomiting.
          </p>
        </div>
      </section>
    </main>
  );
}
