export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { brandPlusName } from '@/lib/product-display';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { Pagination } from '@/components/admin/Pagination';
import { ReviewReplyForm } from '@/components/admin/ReviewReplyForm';
import {
  AddReviewToggle,
  EditReviewButton,
  UnapproveButton,
  type ProductOption,
} from '@/components/admin/ReviewAdminControls';
import { approveReview, deleteReview } from './actions';

const PAGE_SIZE = 25;

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

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string; created?: string; updated?: string; replied?: string;
    q?: string; product?: string; status?: string; page?: string;
  }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('reviews'))) {
    return <NoAccess section="Reviews" />;
  }
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? '').trim();
  const productFilter = (sp.product ?? '').trim();
  const statusFilter = sp.status === 'approved' || sp.status === 'pending' ? sp.status : 'all';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // The current filtered view, threaded through the reply form's redirect so
  // saving a reply lands back on the same page of the same filter.
  const qs = new URLSearchParams();
  if (q) qs.set('q', q);
  if (productFilter) qs.set('product', productFilter);
  if (statusFilter !== 'all') qs.set('status', statusFilter);
  if (page > 1) qs.set('page', String(page));
  const returnTo = `/admin/reviews${qs.size ? `?${qs.toString()}` : ''}`;

  // product_reviews anon SELECT policy filters to approved=true, so the
  // public client never sees pending reviews. Service role bypasses
  // the policy and is the right credential for moderation.
  const admin = supabaseAdmin();

  const REVIEW_COLS = 'id, author_name, rating, body, created_at, approved, product_id, photo_urls, verified_purchase, owner_reply, owner_reply_at, products(name, brand)';

  // Filtered list (search + product + status), paginated with a real count —
  // the old page silently capped approved reviews at the latest 20.
  const applyFilters = <T,>(qb: T): T => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let b = qb as any;
    if (statusFilter !== 'all') b = b.eq('approved', statusFilter === 'approved');
    if (productFilter) b = b.eq('product_id', productFilter);
    if (q) {
      const term = q.replace(/[(),*]/g, ' ').trim();
      b = b.or(`author_name.ilike.%${term}%,body.ilike.%${term}%`);
    }
    return b as T;
  };

  const [
    { data: pending },
    { data: pageRows },
    { count: totalCount },
    { data: productRows },
    { data: reviewedProductRows },
  ] = await Promise.all([
    // The moderation queue, always shown in full at the top.
    admin.from('product_reviews').select(REVIEW_COLS)
      .eq('approved', false)
      .order('created_at', { ascending: false }),
    applyFilters(admin.from('product_reviews').select(REVIEW_COLS))
      .order('created_at', { ascending: false })
      .range(from, to),
    applyFilters(admin.from('product_reviews').select('id', { count: 'exact', head: true })),
    admin.from('products').select('id, name, brand')
      .eq('status', 'published')
      .order('name', { ascending: true })
      .limit(500),
    // Products that actually have reviews, for the filter dropdown.
    admin.from('product_reviews').select('product_id, products(name, brand)').limit(1000),
  ]);

  type ReviewRow = {
    id: string;
    author_name: string;
    rating: number;
    body: string;
    created_at: string;
    approved: boolean;
    photo_urls: string[] | null;
    verified_purchase: boolean;
    owner_reply: string | null;
    owner_reply_at: string | null;
    // Supabase returns a to-one embed as an object; tolerate an array too.
    products: { name: string; brand: string } | { name: string; brand: string }[] | null;
  };

  const pendingList = (pending ?? []) as unknown as ReviewRow[];
  const list = (pageRows ?? []) as unknown as ReviewRow[];
  const total = totalCount ?? 0;
  const products = (productRows ?? []) as ProductOption[];

  // Dedupe the reviewed-products rows into filter options.
  const reviewedById = new Map<string, string>();
  for (const r of (reviewedProductRows ?? []) as unknown as Array<{ product_id: string; products: { name: string; brand: string } | { name: string; brand: string }[] | null }>) {
    if (reviewedById.has(r.product_id)) continue;
    const p = Array.isArray(r.products) ? r.products[0] : r.products;
    reviewedById.set(r.product_id, p ? brandPlusName(p.brand, p.name) : r.product_id);
  }
  const reviewedProducts = [...reviewedById.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const rowStyle: React.CSSProperties = {
    borderTop: '1px solid #f3f4f6', padding: '16px 20px',
    display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start',
  };

  function ReviewCard({ r, showApprove }: { r: ReviewRow; showApprove: boolean }) {
    // .adm-review-row / .adm-review-actions: below 768px (AdminShell CSS) the
    // "text | actions" grid becomes a stacked card, full-width review text
    // with a 40px-tall action button row underneath.
    return (
      <div className="adm-review-row" style={rowStyle}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
            <Stars rating={r.rating} />
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>{r.author_name}</span>
            {r.verified_purchase && (
              <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 20, padding: '2px 8px', fontSize: '0.6875rem', fontWeight: 700 }}>
                Verified purchase
              </span>
            )}
            {!showApprove && !r.approved && (
              <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 8px', fontSize: '0.6875rem', fontWeight: 700 }}>
                Pending
              </span>
            )}
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{fmtDate(r.created_at)}</span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: 6 }}>
            {(() => {
              const p = Array.isArray(r.products) ? r.products[0] : r.products;
              return p ? brandPlusName(p.brand, p.name) : '—';
            })()}
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
          {r.owner_reply && (
            <div style={{
              marginTop: 10, padding: '8px 12px', background: '#fdf2f8',
              borderLeft: '3px solid #C5286A', borderRadius: '0 8px 8px 0',
            }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9d174d', marginBottom: 3 }}>
                Public reply{r.owner_reply_at ? ` · ${fmtDate(r.owner_reply_at)}` : ''}
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#374151', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{r.owner_reply}</p>
            </div>
          )}
          {/* Public reply belongs on live reviews; the queue should be
              approve/reject first. */}
          {r.approved && (
            <div style={{ marginTop: 10 }}>
              <ReviewReplyForm reviewId={r.id} existingReply={r.owner_reply} returnTo={returnTo} />
            </div>
          )}
        </div>
        <div className="adm-review-actions" style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!r.approved ? (
            <form action={approveReview}>
              <input type="hidden" name="id" value={r.id} />
              <button type="submit" style={{
                padding: '6px 14px', background: '#10b981', color: 'white',
                border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
              }}>Approve</button>
            </form>
          ) : (
            <UnapproveButton id={r.id} />
          )}
          <EditReviewButton id={r.id} authorName={r.author_name} rating={r.rating} body={r.body} />
          <DeleteButton id={r.id} action={deleteReview} confirmMsg={`Delete the review by ${r.author_name}?`} />
        </div>
      </div>
    );
  }

  const feedback = sp.error
    ? { kind: 'error' as const, text: sp.error }
    : sp.created
      ? { kind: 'ok' as const, text: 'Review added.' }
      : sp.updated
        ? { kind: 'ok' as const, text: 'Review updated.' }
        : sp.replied
          ? { kind: 'ok' as const, text: 'Public reply saved — it now shows under the review on the product page.' }
          : null;

  const filtersActive = Boolean(q || productFilter || statusFilter !== 'all');
  const selStyle: React.CSSProperties = {
    padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7,
    fontSize: '0.8125rem', background: 'white', maxWidth: 260,
  };

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Reviews</h1>
      <p style={{ margin: '0 0 32px', color: '#6b7280', fontSize: '0.875rem' }}>
        Moderate customer product reviews before they appear on the site, and reply publicly to live ones
      </p>

      {feedback && (
        <div
          role="status"
          style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem',
            background: feedback.kind === 'error' ? '#fef2f2' : '#f0fdf4',
            color: feedback.kind === 'error' ? '#991b1b' : '#166534',
            border: `1px solid ${feedback.kind === 'error' ? '#fecaca' : '#bbf7d0'}`,
          }}
        >
          {feedback.text}
        </div>
      )}

      <AddReviewToggle products={products} />

      {/* Pending queue — always in full, this is the morning-triage list. */}
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

      {/* All reviews — searchable, filterable, paginated. */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
            All Reviews <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '0.875rem' }}>({total})</span>
          </h2>
          <form method="get" action="/admin/reviews" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
            <input
              type="search" name="q" defaultValue={q} placeholder="Search name or text…"
              aria-label="Search reviews" style={{ ...selStyle, width: 190 }}
            />
            <select name="product" defaultValue={productFilter} aria-label="Filter by product" style={selStyle}>
              <option value="">All products</option>
              {reviewedProducts.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <select name="status" defaultValue={statusFilter} aria-label="Filter by status" style={selStyle}>
              <option value="all">All statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
            </select>
            <button type="submit" style={{
              padding: '8px 14px', background: '#111827', color: 'white', border: 'none',
              borderRadius: 7, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
            }}>Filter</button>
            {filtersActive && (
              <a href="/admin/reviews" style={{ fontSize: '0.8125rem', color: '#6b7280', textDecoration: 'none' }}>Clear</a>
            )}
          </form>
        </div>
        {list.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            {filtersActive ? 'No reviews match these filters.' : 'No reviews yet'}
          </div>
        ) : (
          list.map(r => <ReviewCard key={r.id} r={r} showApprove={false} />)
        )}
      </div>

      <Suspense fallback={null}>
        <Pagination
          total={total}
          pageSize={PAGE_SIZE}
          currentPage={page}
          basePath="/admin/reviews"
        />
      </Suspense>
    </div>
  );
}
