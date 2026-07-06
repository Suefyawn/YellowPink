export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { AdminFlash } from '@/components/admin/AdminFlash';
import { suggestReviewer, type MatchableReviewer } from '@/lib/reviewer-match';
import { assignPostReviewer } from '../actions';

interface PostRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt: string | null;
  topic: string | null;
  reviewer_id: string | null;
}

// Specialty-match triage for the whole journal: every post scored against the
// review board (same lib as the live hint in the post editor), grouped into
// what needs a decision vs what already matches. Assignments stay per-post
// and explicit — the byline is a truth claim about who reviewed the article.
export default async function ReviewerAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('blog'))) {
    return <NoAccess section="Reviewer assignments" />;
  }
  const sp = await searchParams;

  const admin = supabaseAdmin();
  const [{ data: postRows }, { data: reviewerRows }] = await Promise.all([
    admin.from('blog_posts').select('id, slug, title, category, excerpt, topic, reviewer_id').order('category').order('title'),
    admin.from('content_reviewers').select('id, name, specialty, review_topics, is_default, active'),
  ]);
  const posts = (postRows ?? []) as PostRow[];
  const reviewers = (reviewerRows ?? []) as MatchableReviewer[];
  const reviewerName = new Map(reviewers.map(r => [r.id, r.name]));

  const scored = posts.map(p => ({ post: p, suggestion: suggestReviewer(p, reviewers) }));
  const needsAttention = scored.filter(s => s.suggestion && s.suggestion.reviewerId !== s.post.reviewer_id);
  const matching = scored.filter(s => s.suggestion && s.suggestion.reviewerId === s.post.reviewer_id);
  // Non-medical posts carrying a reviewer byline are worth a look too.
  const nonMedicalWithReviewer = scored.filter(s => !s.suggestion && s.post.reviewer_id);
  const nonMedical = scored.filter(s => !s.suggestion && !s.post.reviewer_id);

  const th: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const td: React.CSSProperties = { padding: '10px 16px', fontSize: '0.8125rem', color: '#374151', verticalAlign: 'top' };

  const assignButton = (postId: string, reviewerId: string | null, label: string) => (
    <form action={assignPostReviewer} style={{ display: 'inline' }}>
      <input type="hidden" name="post_id" value={postId} />
      <input type="hidden" name="reviewer_id" value={reviewerId ?? ''} />
      <button type="submit" style={{
        padding: '5px 12px', borderRadius: 6, border: '1px solid #f9a8d4',
        background: 'white', color: '#9d174d', fontSize: '0.75rem', fontWeight: 600,
        cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 30,
      }}>
        {label}
      </button>
    </form>
  );

  const section = (
    title: string,
    hint: string,
    rows: typeof scored,
    showAction: boolean,
  ) => (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
        {title} <span style={{ color: '#9ca3af', fontWeight: 500 }}>({rows.length})</span>
      </h2>
      <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: '#6b7280' }}>{hint}</p>
      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: '0.8125rem' }}>Nothing here.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th scope="col" style={th}>Post</th>
                  <th scope="col" style={th}>Category</th>
                  <th scope="col" style={th}>Current reviewer</th>
                  <th scope="col" style={th}>Suggested</th>
                  {showAction && <th scope="col" style={th}></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ post, suggestion }) => (
                  <tr key={post.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td data-label="Post" style={td}>
                      <Link href={`/admin/blog/${post.id}`} style={{ color: '#111827', fontWeight: 500, textDecoration: 'none' }}>
                        {post.title}
                      </Link>
                      <div>
                        <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.6875rem', color: '#9ca3af', textDecoration: 'none' }}>
                          /blog/{post.slug} ↗
                        </a>
                      </div>
                    </td>
                    <td data-label="Category" style={{ ...td, whiteSpace: 'nowrap' }}>{post.category}</td>
                    <td data-label="Current" style={{ ...td, whiteSpace: 'nowrap' }}>
                      {post.reviewer_id
                        ? reviewerName.get(post.reviewer_id) ?? <span style={{ color: '#dc2626' }}>Unknown reviewer</span>
                        : <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td data-label="Suggested" style={td}>
                      {suggestion ? (
                        <>
                          <span style={{ fontWeight: 600, color: '#9d174d' }}>{suggestion.reviewerName}</span>
                          <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: 2 }}>{suggestion.reason}</div>
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>not a medical topic</span>
                      )}
                    </td>
                    {showAction && (
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {suggestion
                          ? assignButton(post.id, suggestion.reviewerId, `Assign ${suggestion.reviewerName.split(' ').slice(0, 2).join(' ')}`)
                          : assignButton(post.id, null, 'Remove reviewer')}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <AdminFlash message={sp.saved ?? sp.error} type={sp.error ? 'error' : 'success'} clearPath="/admin/reviewers/assignments" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <Link href="/admin/reviewers" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>← Review Board</Link>
      </div>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Reviewer assignments</h1>
      <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: '#6b7280', maxWidth: 720 }}>
        Every article scored against the board&apos;s specialties — the same matcher that suggests a reviewer in
        the post editor. Assigning changes the public &ldquo;Medically reviewed by&rdquo; byline immediately, so
        only assign once the doctor has actually reviewed the article (they see their credited articles in
        their portal).
      </p>

      {section(
        'Needs a decision',
        'The specialty match differs from the current assignment (or the post has none). Review and assign — or keep the current reviewer if they did review it.',
        needsAttention,
        true,
      )}
      {nonMedicalWithReviewer.length > 0 && section(
        'Non-medical posts with a reviewer byline',
        'These categories carry no medical claim; a “medically reviewed” line here reads as noise. Consider removing it.',
        nonMedicalWithReviewer,
        true,
      )}
      {section(
        'Already matching',
        'Assigned reviewer agrees with the specialty match — nothing to do.',
        matching,
        false,
      )}
      {section(
        'Non-medical',
        'Makeup and other non-health topics; no reviewer needed.',
        nonMedical,
        false,
      )}
    </div>
  );
}
