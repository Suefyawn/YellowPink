'use client';

import { useActionState } from 'react';
import { submitQuestion } from '@/app/product/[slug]/actions';
import { fmtDatePK } from '@/lib/dates';

export interface ProductQuestionItem {
  id: string;
  author_name: string;
  question: string;
  answer: string | null;
  created_at: string;
  answered_at: string | null;
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '0.875rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

/** Asker attribution: first name only, so a published Q&A never exposes a
 *  customer's full name. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Customer';
}

// ─── Product Q&A ────────────────────────────────────────────────────────────
// Renders below the Reviews section. Approved Q&As are passed in from the
// server route, so the question/answer text is in the crawlable HTML payload.
// The ask form mirrors the review form's submission grammar (useActionState →
// server action → moderation queue). Deliberately NO FAQPage JSON-LD: Google
// restricted FAQ rich results, and the visible unique content is the point.
export function QuestionsSection({ productId, questions }: { productId: string; questions: ProductQuestionItem[] }) {
  const [state, action, pending] = useActionState(submitQuestion, null);

  const askForm = state && 'success' in state ? (
    <div style={{ padding: '20px 24px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 'var(--radius-card)', color: '#166534', fontWeight: 600 }}>
      Thank you! We&rsquo;ll publish your question once it&rsquo;s answered.
    </div>
  ) : (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <input type="hidden" name="product_id" value={productId} />

      <div>
        <label htmlFor="question-author-name" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Name *</label>
        <input id="question-author-name" name="author_name" required maxLength={80} autoComplete="name" placeholder="Your name" style={inp} />
      </div>

      <div>
        <label htmlFor="question-body" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Your question *</label>
        <textarea
          id="question-body"
          name="question" required minLength={10} maxLength={500} rows={4}
          placeholder="What would you like to know about this product?"
          style={{ ...inp, resize: 'vertical' }}
        />
      </div>

      {state && 'error' in state && state.error && (
        <p style={{ margin: 0, color: '#ef4444', fontSize: '0.8125rem' }}>{state.error}</p>
      )}

      <button type="submit" disabled={pending} className="btn-primary" style={{ alignSelf: 'flex-start', opacity: pending ? 0.6 : 1 }}>
        {pending ? 'Sending…' : 'Ask question'}
      </button>
    </form>
  );

  // No approved Q&As yet: just the ask form with a short lead line, single
  // column — no empty-list scaffolding.
  if (questions.length === 0) {
    return (
      <section id="questions" style={{ padding: 'var(--section-gap) 0', borderTop: '1px solid var(--line)', scrollMarginTop: 80 }}>
        <div className="container">
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 500, margin: '0 0 8px' }}>
              Questions &amp; answers
            </h2>
            <p className="small-text" style={{ margin: '0 0 20px', color: 'var(--ink-700)', lineHeight: 1.55 }}>
              Not sure about shade, size, ingredients or how to use it? Ask here — our team
              answers, and helpful Q&amp;As are published on this page.
            </p>
            {askForm}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="questions" style={{ padding: 'var(--section-gap) 0', borderTop: '1px solid var(--line)', scrollMarginTop: 80 }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }} className="duo-grid">

          {/* Left: answered questions (server-rendered, crawlable) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 500, margin: 0 }}>
                Questions &amp; answers
              </h2>
              <span style={{ fontSize: '0.875rem', color: 'var(--ink-500)' }}>
                ({questions.length} answered)
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {questions.map(q => (
                <div key={q.id} style={{ padding: '16px 20px', background: 'white', borderRadius: 'var(--radius-card)', border: '1px solid var(--line)' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink-900)', lineHeight: 1.5 }}>
                    Q: {q.question}
                  </p>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-400)', marginBottom: 10 }}>
                    Asked by {firstName(q.author_name)} · {fmtDatePK(q.created_at)}
                  </div>
                  {q.answer && (
                    <div style={{
                      padding: '10px 14px',
                      background: 'var(--paper2)', borderLeft: '3px solid var(--brand-pink-cta)',
                      borderRadius: '0 8px 8px 0',
                    }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-700)', marginBottom: 4 }}>
                        Answer from Yellow Pink
                        {q.answered_at && (
                          <span style={{ fontWeight: 400, color: 'var(--ink-400)' }}>
                            {' '}· {fmtDatePK(q.answered_at)}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--ink-700)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{q.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: ask form, sticky like the review form. */}
          <div id="question-form" style={{ position: 'sticky', top: 100, scrollMarginTop: 90 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 500, margin: '0 0 8px' }}>
              Ask a question
            </h2>
            <p className="small-text" style={{ margin: '0 0 20px', color: 'var(--ink-700)', lineHeight: 1.55 }}>
              Not sure about shade, size, ingredients or how to use it? Ask here — our team
              answers, and helpful Q&amp;As are published on this page.
            </p>
            {askForm}
          </div>
        </div>
      </div>
    </section>
  );
}
