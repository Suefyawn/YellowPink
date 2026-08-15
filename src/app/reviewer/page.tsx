export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSignedInReviewer, getReviewedPosts } from '@/lib/reviewer-portal';
import { updateReviewerProfile, signOutReviewer, flagArticleConcern } from './actions';
import { PhotoUpload } from '@/components/reviewers/PhotoUpload';
import { REVIEW_TOPICS, canonicalTopics } from '@/lib/review-topics';
import { PK_TZ } from '@/lib/dates';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.yellowpink.pk';

const field: React.CSSProperties = {
  width: '100%', padding: '11px 13px', background: '#fff', border: '1px solid var(--line)',
  borderRadius: 6, color: 'var(--ink-900)', fontSize: '0.9375rem', outline: 'none', boxSizing: 'border-box',
};
const label: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6,
};
const statCard: React.CSSProperties = { padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--paper)', textAlign: 'center' };
const statNum: React.CSSProperties = { fontSize: '1.375rem', fontWeight: 700, color: 'var(--ink-900)', lineHeight: 1.1 };
const statLbl: React.CSSProperties = { fontSize: '0.7rem', color: 'var(--ink-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 2 };

function ago(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: PK_TZ });
}

export default async function ReviewerDashboard({ searchParams }: { searchParams?: Promise<{ sent?: string }> }) {
  const sp = (await searchParams) ?? {};
  const reviewer = await getSignedInReviewer();
  if (!reviewer) redirect('/reviewer/login');

  const posts = await getReviewedPosts(reviewer.id);
  // Every assigned post is live (blog_posts has no draft/published state), so
  // the reviewer's assigned count is their published count.
  const publishedCount = posts.length;
  // Profile completeness encourages a rich, trustworthy public profile.
  const checks = [
    !!reviewer.credentials, !!reviewer.specialty, !!reviewer.bio, !!reviewer.photo_url,
    !!reviewer.profile_url, !!reviewer.affiliation, !!reviewer.education,
    !!reviewer.experience_years, reviewer.languages.length > 0, reviewer.review_topics.length > 0,
  ];
  const completeness = Math.round((checks.filter(Boolean).length / checks.length) * 100);

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

          {sp.sent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 0', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, fontSize: '0.875rem', color: '#15803d' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              Thank you, your note has been sent to the editorial team. They will follow up on it.
            </div>
          )}

          {reviewer.active && (
            <p className="small-text" style={{ color: 'var(--ink-500)', margin: '0 0 32px' }}>
              Your public profile: <Link href={`/medical-review-board/${reviewer.slug}`} style={{ color: 'var(--brand-pink-text, #9d174d)', fontWeight: 600 }}>{SITE}/medical-review-board/{reviewer.slug}</Link>
            </p>
          )}

          {/* Stats + profile completeness */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, margin: '0 0 18px' }}>
            <div style={statCard}><div style={statNum}>{posts.length}</div><div style={statLbl}>Assigned</div></div>
            <div style={statCard}><div style={statNum}>{publishedCount}</div><div style={statLbl}>Published</div></div>
            <div style={statCard}><div style={statNum}>{completeness}%</div><div style={statLbl}>Profile complete</div></div>
          </div>
          {completeness < 100 && (
            <div style={{ margin: '0 0 24px' }}>
              <div style={{ height: 8, background: 'var(--paper2)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${completeness}%`, height: '100%', background: 'var(--brand-pink-text, #9d174d)' }} />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--ink-500)', marginTop: 6 }}>
                A complete profile builds more trust with readers and search engines. Fill in the fields below.
              </p>
            </div>
          )}

          {/* Profile editor */}
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
              <label style={label}>Review topics</label>
              <p style={{ fontSize: '0.75rem', color: 'var(--ink-500)', margin: '0 0 8px' }}>Tick the areas you&apos;re comfortable reviewing. Articles on these topics are routed to you.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px 14px' }}>
                {(() => { const checked = new Set(canonicalTopics(reviewer.review_topics)); return REVIEW_TOPICS.map(t => (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--ink-700)' }}>
                    <input type="checkbox" name="review_topics" value={t} defaultChecked={checked.has(t)} /> {t}
                  </label>
                )); })()}
              </div>
            </div>
            <div>
              <label htmlFor="d-profile" style={label}>Verifiable profile link</label>
              <input id="d-profile" name="profile_url" type="url" defaultValue={reviewer.profile_url ?? ''} style={field} placeholder="PMDC / hospital / LinkedIn" />
            </div>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <label htmlFor="d-affil" style={label}>Clinic / hospital</label>
                <input id="d-affil" name="affiliation" defaultValue={reviewer.affiliation ?? ''} style={field} placeholder="Aga Khan University Hospital" />
              </div>
              <div>
                <label htmlFor="d-exp" style={label}>Years of experience</label>
                <input id="d-exp" name="experience_years" type="number" min="0" defaultValue={reviewer.experience_years ?? ''} style={field} placeholder="8" />
              </div>
            </div>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <label htmlFor="d-edu" style={label}>Education / training</label>
                <input id="d-edu" name="education" defaultValue={reviewer.education ?? ''} style={field} placeholder="King Edward Medical University" />
              </div>
              <div>
                <label htmlFor="d-lang" style={label}>Languages</label>
                <input id="d-lang" name="languages" defaultValue={reviewer.languages.join(', ')} style={field} placeholder="English, Urdu" />
                <p style={{ fontSize: '0.75rem', color: 'var(--ink-500)', marginTop: 4 }}>Comma-separated.</p>
              </div>
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
              Nothing yet. When an article is assigned to you, we email you and it appears here with your byline.
            </p>
          ) : (
            <>
              <p style={{ fontSize: '0.8125rem', color: 'var(--ink-500)', margin: '-8px 0 14px', lineHeight: 1.6 }}>
                These live articles carry your &ldquo;Medically reviewed by&rdquo; byline. Please read anything new
                soon after our email; if something needs correcting, use <strong>Flag a concern</strong> below and
                the editorial team will fix or reassign it.
              </p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
                {posts.map(p => (
                  <li key={p.slug} style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--paper)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                      <div style={{ minWidth: 0 }}>
                        <Link href={`/blog/${p.slug}`} style={{ fontWeight: 600, color: 'var(--ink-900)', textDecoration: 'none' }}>{p.title}</Link>
                        <div style={{ fontSize: '0.75rem', color: 'var(--ink-500)', marginTop: 2 }}>Added {ago(p.created_at)}</div>
                      </div>
                      <span style={{ flexShrink: 0, padding: '2px 10px', borderRadius: 20, fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em',
                        background: '#f0fdf4', color: '#15803d' }}>
                        Published
                      </span>
                    </div>
                    {/* Flag a concern: a <details> keeps the note form tucked away
                        with no client JS; submitting notifies the admin team. */}
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-500)', listStyle: 'none' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" x2="4" y1="22" y2="15" /></svg>
                        Flag a concern
                      </summary>
                      <form action={flagArticleConcern} style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        <input type="hidden" name="post_id" value={p.id} />
                        <textarea
                          name="note" required rows={3} maxLength={2000}
                          placeholder="What should we correct or change in this article?"
                          style={{ ...field, resize: 'vertical', fontSize: '0.875rem' }}
                        />
                        <div>
                          <button type="submit" className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.8125rem' }}>
                            Send to the editorial team
                          </button>
                        </div>
                      </form>
                    </details>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Account */}
          <h2 className="h2" style={{ fontSize: '1.25rem', margin: '40px 0 16px' }}>Account</h2>
          <div style={{ padding: 20, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--paper)', display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: '0.9375rem' }}>
              <span style={{ color: 'var(--ink-500)', fontWeight: 600 }}>Email</span>
              <span style={{ color: 'var(--ink-900)' }}>{reviewer.email ?? 'Not set'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: '0.9375rem' }}>
              <span style={{ color: 'var(--ink-500)', fontWeight: 600 }}>Sign-in</span>
              <span style={{ color: 'var(--ink-900)' }}>Secure email link (no password)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: '0.9375rem' }}>
              <span style={{ color: 'var(--ink-500)', fontWeight: 600 }}>Status</span>
              <span style={{ color: reviewer.active ? '#15803d' : '#b45309', fontWeight: 600 }}>{reviewer.active ? 'Active, visible on the board' : 'Hidden, being set up'}</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-500)', margin: 0, lineHeight: 1.6 }}>
              You sign in with a one-time link sent to your email, so there is no password to manage. To change your email or close your account, contact us.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
