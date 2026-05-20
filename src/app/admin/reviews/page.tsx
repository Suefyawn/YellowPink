export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { brandPlusName } from '@/lib/product-display';
import { approveReview, deleteReview } from './actions';

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

function Stars({ rating }: { rating: number }) {
  return (
    <span>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= rating ? '#F7C948' : '#e5e7eb', fontSize: '1rem' }}>★</span>
      ))}
    </span>
  );
}

export default async function ReviewsPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('reviews')) {
    return <NoAccess section="Reviews" />;
  }

  // product_reviews anon SELECT policy filters to approved=true, so the
  // public client never sees pending reviews. Service role bypasses
  // the policy and is the right credential for moderation.
  const admin = supabaseAdmin();
  const { data: pending } = await admin
    .from('product_reviews')
    .select('id, author_name, rating, body, created_at, approved, product_id, photo_urls, verified_purchase, products(name, brand)')
    .eq('approved', false)
    .order('created_at', { ascending: false });

  const { data: approved } = await admin
    .from('product_reviews')
    .select('id, author_name, rating, body, created_at, approved, product_id, photo_urls, verified_purchase, products(name, brand)')
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(20);

  type ReviewRow = {
    id: string;
    author_name: string;
    rating: number;
    body: string;
    created_at: string;
    approved: boolean;
    photo_urls: string[] | null;
    verified_purchase: boolean;
    products: { name: string; brand: string }[] | null;
  };

  const pendingList = (pending ?? []) as unknown as ReviewRow[];
  const approvedList = (approved ?? []) as unknown as ReviewRow[];

  const rowStyle: React.CSSProperties = {
    borderTop: '1px solid #f3f4f6', padding: '16px 20px',
    display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start',
  };

  function ReviewCard({ r, showApprove }: { r: ReviewRow; showApprove: boolean }) {
    return (
      <div style={rowStyle}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
            <Stars rating={r.rating} />
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>{r.author_name}</span>
            {r.verified_purchase && (
              <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 20, padding: '2px 8px', fontSize: '0.6875rem', fontWeight: 700 }}>
                Verified purchase
              </span>
            )}
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{fmtDate(r.created_at)}</span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: 6 }}>
            {r.products?.[0] ? brandPlusName(r.products[0].brand, r.products[0].name) : '—'}
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>{r.body}</p>
          {r.photo_urls && r.photo_urls.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {r.photo_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Review photo ${i + 1}`}
                    style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                </a>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {showApprove && (
            <form action={approveReview}>
              <input type="hidden" name="id" value={r.id} />
              <button type="submit" style={{
                padding: '6px 14px', background: '#10b981', color: 'white',
                border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
              }}>Approve</button>
            </form>
          )}
          <form action={deleteReview}>
            <input type="hidden" name="id" value={r.id} />
            <button type="submit" style={{
              padding: '6px 14px', background: '#fef2f2', color: '#ef4444',
              border: '1px solid #fecaca', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
            }}>Delete</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Reviews</h1>
      <p style={{ margin: '0 0 32px', color: '#6b7280', fontSize: '0.875rem' }}>
        Moderate customer product reviews before they appear on the site
      </p>

      {/* Pending */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 32, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Pending Approval</h2>
          {pendingList.length > 0 && (
            <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>
              {pendingList.length}
            </span>
          )}
        </div>
        {pendingList.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No reviews pending approval
          </div>
        ) : (
          pendingList.map(r => <ReviewCard key={r.id} r={r} showApprove={true} />)
        )}
      </div>

      {/* Approved */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
            Approved Reviews <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '0.875rem' }}>(last 20)</span>
          </h2>
        </div>
        {approvedList.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No approved reviews yet
          </div>
        ) : (
          approvedList.map(r => <ReviewCard key={r.id} r={r} showApprove={false} />)
        )}
      </div>
    </div>
  );
}
