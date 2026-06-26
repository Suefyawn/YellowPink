export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSignedInReviewer, getReviewedPosts } from '@/lib/reviewer-portal';
import { updateReviewerProfile, signOutReviewer } from './actions';
import { PhotoUpload } from '@/components/reviewers/PhotoUpload';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.yellowpink.pk';

const field: React.CSSProperties = {
  width: '100%', padding: '11px 13px', background: '#fff', border: '1px solid var(--line)',
  borderRadius: 6, color: 'var(--ink-900)', fontSize: '0.9375rem', outline: 'none', boxSizing: 'border-box',
};
const label: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6,
};

function ago(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function ReviewerDashboard() {
  const reviewer = await getSignedInReviewer();
  if (!reviewer) redirect('/reviewer/login');

  const posts = await getReviewedPosts(reviewer.id);

  return (
    <main className="fade-in">
      <section style={{ padding: '48px var(--side)' }}>
        <div className="container" style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reviewer dashboard</div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.875rem', fontWeight: 500, letterSpacing: '-0.025em', margin: '4px 0 0' }}>
                {reviewer.name}
              </h1>
              {!reviewer.active && (
                <span style={{ display: 'inline-block', marginTop: 8, padding: '2px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, color: '#b45309' }}>
                  Profile hidden, being set up
                </span>
              )}
            </div>
            <form action={signOutReviewer}>
              <button type="submit" style={{ padding: '8px 14px', fontSize: '0.8125rem', fontWeight: 600, background: 'none', border: '1px solid var(--line)', borderRadius: 7, cursor: 'pointer', color: 'var(--ink-700)' }}>
                Sign out
              </button>
            </form>
          </div>

          {reviewer.active && (
            <p className="small-text" style={{ color: 'var(--ink-500)', margin: '0 0 32px' }}>
              Your public profile: <Link href={`/medical-review-board/${reviewer.slug}`} style={{ color: 'var(--brand-pink-text, #9d174d)', fontWeight: 600 }}>{SITE}/medical-review-board/{reviewer.slug}</Link>
            </p>
          )}

          {/* ── Profile editor ─────────────────────────────────────────── */}
          <h2 className="h2" style={{ fontSize: '1.25rem', margin: '24px 0 16px' }}>Your profile</h2>
          <form action={updateReviewerProfile} style={{ display: 'grid', gap: 16, padding: 22, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--paper)' }}>
            <div>
              <label style={label}>Name</label>
              <input value={reviewer.name} disabled style={{ ...field, background: 'var(--paper2)', color: 'var(--ink-500)' }} />
              <p style={{ fontSize: '0.75rem', color: 'var(--ink-500)', marginTop: 4 }}>To change your name, contact us, it&rsquo;s tied to your verified credentials.</p>
            </div>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <label htmlFor="d-cred" style={label}>Credentials</label>
                <input id="d-cred" name="credentials" defaultValue={reviewer.credentials ?? ''} style={field} placeholder="MBBS, FCPS" />
              </div>
              <div>
                <label htmlFor="d-spec" style={label}>Specialty</label>
                <input id="d-spec" name="specialty" defaultValue={reviewer.specialty ?? ''} style={field} placeholder="Obstetrics & Gynaecology" />
              </div>
            </div>
            <div>
              <label htmlFor="d-topics" style={label}>Review topics</label>
              <input id="d-topics" name="review_topics" defaultValue={reviewer.review_topics.join(', ')} style={field} placeholder="Women's Health, Fertility" />
              <p style={{ fontSize: '0.75rem', color: 'var(--ink-500)', marginTop: 4 }}>Comma-separated.</p>
            </div>
            <div>
              <label htmlFor="d-profile" style={label}>Verifiable profile link</label>
              <input id="d-profile" name="profile_url" type="url" defaultValue={reviewer.profile_url ?? ''} style={field} placeholder="PMDC / hospital / LinkedIn" />
            </div>
            <div>
              <span style={label}>Photo</span>
              <PhotoUpload name="photo_url" defaultUrl={reviewer.photo_url ?? ''} />
            </div>
            <div>
              <label htmlFor="d-bio" style={label}>Short bio</label>
              <textarea id="d-bio" name="bio" rows={4} defaultValue={reviewer.bio ?? ''} style={{ ...field, resize: 'vertical' }} placeholder="A line or two about your practice and experience." />
            </div>
            <div>
              <button type="submit" className="btn-primary" style={{ padding: '11px 24px' }}>Save profile</button>
            </div>
          </form>

          {/* ── Articles credited to this reviewer ─────────────────────── */}
          <h2 className="h2" style={{ fontSize: '1.25rem', margin: '40px 0 16px' }}>
            Articles you&rsquo;ve reviewed{posts.length ? ` (${posts.length})` : ''}
          </h2>
          {posts.length === 0 ? (
            <p className="body-text" style={{ color: 'var(--ink-500)' }}>
              Nothing yet. When we assign an article to you, it appears here with your byline once published.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {posts.map(p => (
                <li key={p.slug} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--paper)' }}>
                  <div style={{ minWidth: 0 }}>
                    {p.status === 'published'
                      ? <Link href={`/blog/${p.slug}`} style={{ fontWeight: 600, color: 'var(--ink-900)', textDecoration: 'none' }}>{p.title}</Link>
                      : <span style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{p.title}</span>}
                    <div style={{ fontSize: '0.75rem', color: 'var(--ink-500)', marginTop: 2 }}>Added {ago(p.created_at)}</div>
                  </div>
                  <span style={{ flexShrink: 0, padding: '2px 10px', borderRadius: 20, fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em',
                    background: p.status === 'published' ? '#f0fdf4' : '#f3f4f6',
                    color: p.status === 'published' ? '#15803d' : '#6b7280' }}>
                    {p.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
