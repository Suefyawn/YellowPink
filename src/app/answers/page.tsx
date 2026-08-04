export const revalidate = 3600;

import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMeta, jsonLd, breadcrumbLd } from '@/lib/seo';
import { Overline } from '@/components/ui/Overline';
import { ToolCards } from '@/components/tools/ToolCards';

export function generateMetadata(): Metadata {
  return pageMeta({
    title: 'Quick Answers: Free Health Checks & Calculators',
    description:
      'Free, private tools from Yellow Pink: pregnancy due date calculator, ovulation calculator, BMI with South Asian ranges, daily calorie needs, and a routine finder for your skin.',
    path: '/answers',
  });
}

export default function ToolsPage() {
  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Quick Answers', path: '/answers' },
        ])) }}
      />
      <section style={{ padding: '48px 0 0' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Quick Answers</Overline>
          <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>Quick Answers</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 560, marginBottom: 32 }}>
            The little questions everyone Googles, answered in a tap: your due date, your fertile days, your healthy weight, your daily calories, your skincare routine.
            Everything runs in your browser: no account, no forms, nothing stored.
          </p>
        </div>
      </section>
      <section style={{ paddingBottom: 'var(--section-gap)' }}>
        <div className="container">
          <ToolCards />
          <p className="small-text" style={{ color: 'var(--ink-500)', marginTop: 24 }}>
            Want the reading behind the numbers? The <Link href="/blog" className="text-link">journal</Link> covers
            fertility, skincare and everyday health for Pakistan, reviewed by our{' '}
            <Link href="/medical-review-board" className="text-link">medical review board</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
