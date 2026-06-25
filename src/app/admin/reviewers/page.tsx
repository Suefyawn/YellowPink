export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { saveReviewer, setDefaultReviewer, deleteReviewer } from './actions';

interface ReviewerRow {
  id: string; slug: string; name: string;
  credentials: string | null; specialty: string | null; bio: string | null;
  photo_url: string | null; profile_url: string | null;
  review_topics: string[]; is_default: boolean; active: boolean; sort_order: number;
}

const inp: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none', width: '100%',
};
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 };

function ReviewerForm({ r }: { r?: ReviewerRow }) {
  return (
    <form action={saveReviewer} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
      {r && <input type="hidden" name="id" value={r.id} />}
      <div><label style={lbl}>Name *</label><input name="name" defaultValue={r?.name ?? ''} required placeholder="Dr. Ayesha Khan" style={inp} /></div>
      <div><label style={lbl}>Credentials</label><input name="credentials" defaultValue={r?.credentials ?? ''} placeholder="MBBS, FCPS (Gynaecology)" style={inp} /></div>
      <div><label style={lbl}>Specialty</label><input name="specialty" defaultValue={r?.specialty ?? ''} placeholder="Obstetrics & Gynaecology" style={inp} /></div>
      <div><label style={lbl}>Slug {r ? '' : '(auto from name if blank)'}</label><input name="slug" defaultValue={r?.slug ?? ''} placeholder="ayesha-khan" style={inp} /></div>
      <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Bio</label><textarea name="bio" defaultValue={r?.bio ?? ''} rows={2} placeholder="Short professional bio — where they practise, experience." style={{ ...inp, resize: 'vertical' }} /></div>
      <div><label style={lbl}>Photo URL</label><input name="photo_url" defaultValue={r?.photo_url ?? ''} placeholder="https://…" style={inp} /></div>
      <div><label style={lbl}>Profile URL (PMDC / LinkedIn — sameAs)</label><input name="profile_url" defaultValue={r?.profile_url ?? ''} placeholder="https://…" style={inp} /></div>
      <div><label style={lbl}>Review topics (comma-separated)</label><input name="review_topics" defaultValue={r?.review_topics?.join(', ') ?? ''} placeholder="fertility, PCOS, pregnancy" style={inp} /></div>
      <div><label style={lbl}>Sort order</label><input name="sort_order" type="number" defaultValue={r?.sort_order ?? 0} style={inp} /></div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#374151' }}>
        <input type="checkbox" name="active" defaultChecked={r ? r.active : true} /> Active (visible on the board)
      </label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="submit" className="adm-btn-primary" style={{ padding: '8px 16px', fontSize: '0.8125rem', borderRadius: 7, background: '#111827', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          {r ? 'Save changes' : 'Add reviewer'}
        </button>
      </div>
    </form>
  );
}

export default async function ReviewersPage() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('blog'))) {
    return <NoAccess section="Review Board" />;
  }

  const { data } = await supabaseAdmin()
    .from('content_reviewers')
    .select('id, slug, name, credentials, specialty, bio, photo_url, profile_url, review_topics, is_default, active, sort_order')
    .order('sort_order').order('name');
  const reviewers = (data ?? []) as ReviewerRow[];

  return (
    <div className="adm-page" style={{ padding: '32px 36px', maxWidth: 1000 }}>
      <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Medical Review Board</h1>
      <p style={{ margin: '8px 0 28px', fontSize: '0.875rem', color: '#6b7280', maxWidth: 720 }}>
        Real, qualified doctors who medically review your health/supplement content. They appear on the
        public <Link href="/medical-review-board" style={{ color: '#9d174d', fontWeight: 600 }}>review board</Link> and
        their name + credentials show on the articles assigned to them. <strong>Only add genuine, consenting reviewers</strong> —
        verify credentials (PMDC) before publishing.
      </p>

      {reviewers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
          {reviewers.map(r => (
            <div key={r.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}>
                  {r.name} {r.is_default && <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9d174d', background: '#fdf2f8', padding: '2px 8px', borderRadius: 999, marginLeft: 6 }}>DEFAULT</span>}
                  {!r.active && <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: 999, marginLeft: 6 }}>HIDDEN</span>}
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {!r.is_default && (
                    <form action={setDefaultReviewer}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}>Make default</button>
                    </form>
                  )}
                  <DeleteButton id={r.id} action={deleteReviewer} confirmMsg={`Remove ${r.name} from the review board?`} />
                </div>
              </div>
              <ReviewerForm r={r} />
            </div>
          ))}
        </div>
      )}

      <div style={{ border: '1px dashed #d1d5db', borderRadius: 12, padding: 20, background: '#fafafa' }}>
        <h2 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Add a reviewer</h2>
        <ReviewerForm />
      </div>
    </div>
  );
}
