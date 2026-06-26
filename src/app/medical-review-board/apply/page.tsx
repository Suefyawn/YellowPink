import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMeta, jsonLd, breadcrumbLd } from '@/lib/seo';
import { Overline } from '@/components/ui/Overline';
import { ReviewerApplyForm } from '@/components/reviewers/ReviewerApplyForm';

export function generateMetadata(): Metadata {
  const meta = pageMeta({
    title: 'Apply to the Medical Review Board',
    description:
      'Are you a registered doctor or health professional? Apply to medically review Yellow Pink’s health and supplement content.',
    path: '/medical-review-board/apply',
  });
  // An application form isn't a content page we want competing in the index.
  meta.robots = { index: false, follow: true };
  return meta;
}

export default function ReviewerApplyPage() {
  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Medical Review Board', path: '/medical-review-board' },
          { name: 'Apply', path: '/medical-review-board/apply' },
        ])) }}
      />
      <section style={{ padding: '64px var(--side)' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto' }}>
          <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>
            <Link href="/medical-review-board" style={{ color: 'inherit', textDecoration: 'none' }}>Medical Review Board</Link> / Apply
          </Overline>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, margin: '0 0 16px' }}>
            Join the Medical Review Board
          </h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', fontSize: '1.0625rem', lineHeight: 1.7, marginBottom: 36 }}>
            If you&rsquo;re a registered doctor or health professional, we&rsquo;d be glad to have you
            review content in your area of expertise. Tell us about yourself below. We verify every
            applicant&rsquo;s credentials before approving, and reviewing is a volunteer role &mdash; there&rsquo;s
            no obligation and no payment. Once approved, you get a one-time sign-in link to a dashboard
            where you can manage your profile and see the articles credited to you.
          </p>
          <ReviewerApplyForm />
        </div>
      </section>
    </main>
  );
}
