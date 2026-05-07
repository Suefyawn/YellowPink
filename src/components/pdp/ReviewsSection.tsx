'use client';

import { useActionState } from 'react';
import { submitReview } from '@/app/product/[slug]/actions';

interface Review {
  id: string;
  author_name: string;
  rating: number;
  body: string;
  created_at: string;
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '0.875rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= rating ? '#F7C948' : '#e5e7eb'}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

function StarPicker({ name }: { name: string }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[5, 4, 3, 2, 1].map(v => (
        <label key={v} style={{ cursor: 'pointer', fontSize: 0 }}>
          <input type="radio" name={name} value={v} required style={{ position: 'absolute', opacity: 0, width: 0 }} />
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#e5e7eb"
            style={{ display: 'block', transition: 'fill 0.1s' }}
            onMouseEnter={e => {
              let el: Element | null = e.currentTarget;
              while (el) { (el as SVGElement).style.fill = '#F7C948'; el = el.nextElementSibling; }
              el = e.currentTarget.previousElementSibling;
              while (el) { (el as SVGElement).style.fill = '#F7C948'; el = el.previousElementSibling; }
            }}
            onMouseLeave={e => {
              const parent = e.currentTarget.parentElement?.parentElement;
              if (!parent) return;
              parent.querySelectorAll('svg').forEach(s => { (s as SVGElement).style.fill = '#e5e7eb'; });
            }}
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </label>
      ))}
    </div>
  );
}

export function ReviewsSection({ productId, reviews }: { productId: string; reviews: Review[] }) {
  const [state, action, pending] = useActionState(submitReview, null);
  const avgRating = reviews.length ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 0;

  return (
    <section style={{ padding: 'var(--section-gap) 0', borderTop: '1px solid var(--line)' }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }} className="duo-grid">

          {/* Left: existing reviews */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 500, margin: 0 }}>
                Customer Reviews
              </h2>
              {reviews.length > 0 && (
                <span style={{ fontSize: '0.875rem', color: 'var(--ink-500)' }}>
                  ({reviews.length} review{reviews.length !== 1 ? 's' : ''})
                </span>
              )}
            </div>

            {reviews.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, padding: '16px 20px', background: 'var(--paper2)', borderRadius: 'var(--radius-card)', border: '1px solid var(--line)' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 500 }}>{avgRating}.0</span>
                <div>
                  <Stars rating={avgRating} size={20} />
                  <div style={{ fontSize: '0.8125rem', color: 'var(--ink-500)', marginTop: 4 }}>
                    Based on {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            )}

            {reviews.length === 0 ? (
              <p style={{ color: 'var(--ink-500)', fontSize: '0.875rem' }}>
                No reviews yet. Be the first to review this product!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {reviews.map(r => (
                  <div key={r.id} style={{ padding: '16px 20px', background: 'white', borderRadius: 'var(--radius-card)', border: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-pink)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.875rem' }}>
                          {r.author_name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.author_name}</span>
                      </div>
                      <Stars rating={r.rating} size={14} />
                    </div>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--ink-700)', lineHeight: 1.6 }}>{r.body}</p>
                    <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--ink-400)' }}>
                      {new Date(r.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: write a review */}
          <div style={{ position: 'sticky', top: 100 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 500, margin: '0 0 24px' }}>
              Write a Review
            </h2>

            {state && 'success' in state ? (
              <div style={{ padding: '20px 24px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 'var(--radius-card)', color: '#166534', fontWeight: 600 }}>
                Thank you! Your review has been submitted and will appear after approval.
              </div>
            ) : (
              <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <input type="hidden" name="product_id" value={productId} />

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Your Rating
                  </label>
                  <StarPicker name="rating" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Name
                  </label>
                  <input name="author_name" required placeholder="Your name" style={inp} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Review
                  </label>
                  <textarea
                    name="body" required minLength={10} rows={4}
                    placeholder="Share your experience with this product..."
                    style={{ ...inp, resize: 'vertical' }}
                  />
                </div>

                {state && 'error' in state && (
                  <p style={{ margin: 0, color: '#ef4444', fontSize: '0.8125rem' }}>{state.error}</p>
                )}

                <button type="submit" disabled={pending} className="btn-primary" style={{ alignSelf: 'flex-start', opacity: pending ? 0.6 : 1 }}>
                  {pending ? 'Submitting…' : 'Submit Review'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
