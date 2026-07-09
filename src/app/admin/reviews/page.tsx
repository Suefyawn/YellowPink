export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { supabaseAdmin, getSiteSettings } from '@/lib/supabase';
import { whatsappUrlForCustomer } from '@/lib/whatsapp';
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
import { ReviewsFilter } from '@/components/admin/ReviewsFilter';
import { ViewTabs } from '@/components/admin/ViewTabs';
import { DotChip } from '@/components/admin/OrderChips';
import { approveReview, deleteReview } from './actions';
import { fmtDatePK as fmtDate } from '@/lib/dates';

const PAGE_SIZE = 25;


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

  const REVIEW_COLS = 'id, author_name, rating, body, created_at, approved, product_id, photo_urls, verified_purchase, owner_reply, owner_reply_at, user_id, reviewer_email, products(name, brand)';

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
    { count: allCount },
    { data: productRows },
    { data: reviewedProductRows },
    siteSettings,
  ] = await Promise.all([
    // The moderation queue, always shown in full at the top.
    admin.from('product_reviews').select(REVIEW_COLS)
      .eq('approved', false)
      .order('created_at', { ascending: false }),
    applyFilters(admin.from('product_reviews').select(REVIEW_COLS))
      .order('created_at', { ascending: false })
      .range(from, to),
    applyFilters(admin.from('product_reviews').select('id', { count: 'exact', head: true })),
    admin.from('product_reviews').select('id', { count: 'exact', head: true }),
    admin.from('products').select('id, name, brand')
      .eq('status', 'published')
      .order('name', { ascending: true })
      .limit(500),
    // Products that actually have reviews, for the filter dropdown.
    admin.from('product_reviews').select('product_id, products(name, brand)').limit(1000),
    getSiteSettings(),
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
    user_id: string | null;
    reviewer_email: string | null;
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

  // Google-review ask: only for reviews that are already approved AND positive
  // (4–5★). On-site reviews are moderated so a bad one can be handled quietly;
  // a bad Google review is public and permanent — never invite one. The button
  // opens the reviewer's WhatsApp prefilled with the Google link + the extra
  // points offer (configured in Settings → Loyalty). Google can't tell us who
  // reviewed, so the operator awards the points by hand from the customer page.
  const googleReviewUrl = (siteSettings['google_review_url'] ?? '').trim();
  const googlePoints = Math.max(0, Number(siteSettings['loyalty_google_review_points'] ?? 100) || 0);
  const googleAskById = new Map<string, string>();
  if (googleReviewUrl) {
    const candidates = list.filter(r => r.approved && r.rating >= 4);
    const userIds = [...new Set(candidates.map(r => r.user_id).filter((v): v is string => Boolean(v)))];
    const emails = [...new Set(
      candidates.filter(r => !r.user_id)
        .map(r => (r.reviewer_email ?? '').trim().toLowerCase())
        .filter(Boolean),
    )];
    const phoneByUser = new Map<string, string>();
    const phoneByEmail = new Map<string, string>();
    await Promise.all([
      userIds.length
        ? admin.from('profiles').select('id, phone').in('id', userIds).then(({ data }) => {
            for (const p of (data ?? []) as Array<{ id: string; phone: string | null }>) {
              if (p.phone) phoneByUser.set(p.id, p.phone);
            }
          })
        : null,
      // Guests: latest order phone under the same email. Order emails can be
      // mixed-case, so match with ilike (case-insensitive equality when the
      // pattern has no wildcards). Emails with or()-syntax characters are
      // skipped rather than risking a malformed filter.
      emails.length
        ? (() => {
            const safe = emails.filter(e => !/[,()*%]/.test(e));
            if (!safe.length) return null;
            return admin.from('orders').select('email, phone, created_at')
              .not('phone', 'is', null)
              .or(safe.map(e => `email.ilike.${e}`).join(','))
              .order('created_at', { ascending: false })
              .then(({ data }) => {
                for (const o of (data ?? []) as Array<{ email: string | null; phone: string | null }>) {
                  const key = (o.email ?? '').trim().toLowerCase();
                  if (key && o.phone && !phoneByEmail.has(key)) phoneByEmail.set(key, o.phone);
                }
              });
          })()
        : null,
    ]);
    for (const r of candidates) {
      const phone = r.user_id
        ? phoneByUser.get(r.user_id)
        : phoneByEmail.get((r.reviewer_email ?? '').trim().toLowerCase());
      if (!phone) continue;
      const first = (r.author_name ?? '').trim().split(/\s+/)[0] || '';
      const message = [
        `Assalam-o-Alaikum${first ? ` ${first}` : ''}!`,
        '',
        'Aap ka Yellow Pink par review parh kar bohat khushi hui — shukriya!',
        '',
        `Agar 1 minute nikaal kar wohi baat Google par bhi share kar dein to hamare liye bohat bara favour hoga${googlePoints > 0 ? ` — aur aap ko ${googlePoints} extra reward points milenge jo agle order par discount ban jaate hain` : ''}.`,
        '',
        'Google review yahan chhor sakte hain:',
        googleReviewUrl,
        '',
        ...(googlePoints > 0 ? ['Review ho jaye to bas is message ka reply kar dein, hum points laga denge.', ''] : []),
        'Shukriya!, Team Yellow Pink',
      ].join('\n');
      const href = whatsappUrlForCustomer(phone, message);
      if (href) googleAskById.set(r.id, href);
    }
  }

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
            {r.verified_purchase && <DotChip label="Verified purchase" color="#15803d" />}
            {!showApprove && !r.approved && <DotChip label="Pending" color="#b45309" />}
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
          {googleAskById.has(r.id) && (
            <a
              href={googleAskById.get(r.id)}
              target="_blank"
              rel="noopener noreferrer"
              title="WhatsApp the reviewer a Google-review request with the bonus-points offer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'white', color: '#128C4B', textDecoration: 'none',
                border: '1px solid #25D366',
                padding: '6px 12px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Ask for Google review
            </a>
          )}
          {!r.approved ? (
            <form action={approveReview}>
              <input type="hidden" name="id" value={r.id} />
              <button type="submit" style={{
                padding: '6px 14px', background: '#15803d', color: 'white',
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

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <AddReviewToggle products={products}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Reviews</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
            Moderate customer product reviews before they appear on the site, and reply publicly to live ones
          </p>
        </div>
      </AddReviewToggle>

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

      {/* Pending queue — always in full, this is the morning-triage list. */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 32, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Pending Approval</h2>
          {pendingList.length > 0 && <DotChip label={String(pendingList.length)} color="#b45309" />}
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
        {/* Saved-view tabs (shared underline grammar) replace the old status
            <select>; search + product filters survive a view switch via the
            precomputed hrefs. */}
        {(() => {
          const tabHref = (status: string) => {
            const p2 = new URLSearchParams();
            if (q) p2.set('q', q);
            if (productFilter) p2.set('product', productFilter);
            if (status !== 'all') p2.set('status', status);
            const str = p2.toString();
            return `/admin/reviews${str ? `?${str}` : ''}`;
          };
          const pendingCount = pendingList.length;
          return (
            <div style={{ padding: '0 12px' }}>
              <ViewTabs
                active={statusFilter}
                tabs={[
                  { value: 'all', label: 'All', count: allCount ?? 0, href: tabHref('all') },
                  { value: 'approved', label: 'Approved', count: (allCount ?? 0) - pendingCount, href: tabHref('approved') },
                  { value: 'pending', label: 'Pending', count: pendingCount, href: tabHref('pending') },
                ]}
              />
            </div>
          );
        })()}
        <div style={{ padding: '0 20px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid #f3f4f6' }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
            All Reviews <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '0.875rem' }}>({total})</span>
          </h2>
          <Suspense fallback={null}>
            <ReviewsFilter products={reviewedProducts} />
          </Suspense>
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
