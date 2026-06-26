export const revalidate = 3600;

import type { Metadata } from 'next';
import Link from 'next/link';
import { getActiveReviewers, reviewerFullLabel } from '@/lib/reviewers';
import { pageMeta, jsonLd, breadcrumbLd } from '@/lib/seo';
import { Overline } from '@/components/ui/Overline';

export async function generateMetadata(): Promise<Metadata> {
  const reviewers = await getActiveReviewers();
  const meta = pageMeta({
    title: 'Medical Review Board',
    description:
      'The qualified doctors and health professionals who medically review Yellow Pink’s health and supplement content for accuracy.',
    path: '/medical-review-board',
  });
  // Don't let an empty board get indexed as a thin page — only index once it
  // actually lists reviewers.
  if (reviewers.length === 0) meta.robots = { index: false, follow: true };
  return meta;
}

function Avatar({ name, photo, size = 64 }: { name: string; photo: string | null; size?: number }) {
  const initials = name.replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, '').split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || 'YP';
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={name} width={size} height={size} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--paper2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: size * 0.32, fontWeight: 600, color: 'var(--ink-700)' }}>{initials}</span>
    </div>
  );
}

export default async function MedicalReviewBoardPage() {
  const reviewers = await getActiveReviewers();

  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Medical Review Board', path: '/medical-review-board' }])) }}
      />
      <section style={{ padding: '64px var(--side)' }}>
        <div className="container" style={{ maxWidth: 880, margin: '0 auto' }}>
          <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Expertise you can trust</Overline>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, margin: '0 0 16px' }}>
            Medical Review Board
          </h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', fontSize: '1.0625rem', lineHeight: 1.7, maxWidth: 680, marginBottom: 40 }}>
            Health is a serious responsibility. Our health and supplement articles are medically
            reviewed by qualified, practising doctors and health professionals to make sure the
            information you read is accurate, balanced and safe. Each reviewer checks the content in
            their own area of expertise &mdash; you&rsquo;ll see their name and credentials on the
            articles they&rsquo;ve reviewed.
          </p>

          {reviewers.length === 0 ? (
            <p className="body-text" style={{ color: 'var(--ink-500)', fontStyle: 'italic' }}>
              Our review board is being introduced shortly.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {reviewers.map(r => (
                <Link
                  key={r.id}
                  href={`/medical-review-board/${r.slug}`}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block', padding: 20, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--paper)' }}
                >
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
                    <Avatar name={r.name} photo={r.photo_url} />
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--ink-900)' }}>{r.name}</div>
                      {r.credentials && <div className="small-text" style={{ color: 'var(--ink-500)' }}>{r.credentials}</div>}
                      {r.specialty && <div className="small-text" style={{ color: 'var(--brand-pink-text, #9d174d)', fontWeight: 600, marginTop: 2 }}>{r.specialty}</div>}
                    </div>
                  </div>
                  {r.bio && (
                    <p className="small-text" style={{ color: 'var(--ink-700)', lineHeight: 1.6, margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {r.bio}
                    </p>
                  )}
                  <span style={{ display: 'inline-block', marginTop: 12, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-pink-text, #9d174d)' }}>
                    View profile &rarr;
                  </span>
                </Link>
              ))}
            </div>
          )}

          <div style={{ marginTop: 48, padding: '24px 26px', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--paper2)' }}>
            <div style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>
              Are you a doctor or health professional?
            </div>
            <p className="small-text" style={{ color: 'var(--ink-700)', lineHeight: 1.6, margin: '0 0 14px', maxWidth: 560 }}>
              We welcome qualified, registered clinicians to review content in their specialty. It&rsquo;s a
              volunteer role, and you get a profile on this page plus a byline on the articles you review.
            </p>
            <Link href="/medical-review-board/apply" className="btn-primary" style={{ display: 'inline-block', padding: '10px 22px' }}>
              Apply to join the board
            </Link>
          </div>

          <p className="small-text" style={{ color: 'var(--ink-500)', marginTop: 40, lineHeight: 1.6 }}>
            Medical review confirms that an article is accurate and up to date. It is general
            educational information, not a substitute for personal medical advice &mdash; always
            consult your own doctor or pharmacist about your health.
          </p>

          {/* Hidden machine-readable label so the heading reads naturally above. */}
          <span hidden>{reviewers.map(r => reviewerFullLabel(r)).join('; ')}</span>
        </div>
      </section>
    </main>
  );
}
