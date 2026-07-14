export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { EmptyState } from '@/components/admin/EmptyState';
import { DotChip } from '@/components/admin/OrderChips';
import { brandPlusName } from '@/lib/product-display';
import { answerQuestion, rejectQuestion } from './actions';
import { fmtDatePK as fmtDate } from '@/lib/dates';

// Product Q&A moderation (audit D1), modeled on the Reviews page: the pending
// queue sits on top (with a sidebar badge count), published Q&As below. Every
// question is answered by staff before it appears on the product page.

type QuestionRow = {
  id: string;
  author_name: string;
  question: string;
  answer: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  answered_at: string | null;
  // Supabase returns a to-one embed as an object; tolerate an array too.
  products: { name: string; brand: string } | { name: string; brand: string }[] | null;
};

function productLabel(q: QuestionRow): string {
  const p = Array.isArray(q.products) ? q.products[0] : q.products;
  return p ? brandPlusName(p.brand, p.name) : '—';
}

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('reviews'))) {
    return <NoAccess section="Questions" />;
  }
  const sp = (await searchParams) ?? {};

  // Pending questions never pass the anon SELECT policy (approved only), so
  // moderation reads with the service role, exactly like Reviews.
  const admin = supabaseAdmin();
  const QUESTION_COLS = 'id, author_name, question, answer, status, created_at, answered_at, products(name, brand)';

  const [{ data: pendingRows }, { data: publishedRows }] = await Promise.all([
    admin.from('product_questions').select(QUESTION_COLS)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    admin.from('product_questions').select(QUESTION_COLS)
      .eq('status', 'approved')
      .order('answered_at', { ascending: false })
      .limit(200),
  ]);

  const pending = (pendingRows ?? []) as unknown as QuestionRow[];
  const published = (publishedRows ?? []) as unknown as QuestionRow[];

  const rowStyle: React.CSSProperties = {
    borderTop: '1px solid #f3f4f6', padding: '16px 20px',
    display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start',
  };

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Questions</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
          Answer customer product questions — approved Q&amp;As publish on the product page with your answer
        </p>
      </div>

      {sp.error && (
        <div
          role="status"
          style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem',
            background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
          }}
        >
          {sp.error}
        </div>
      )}

      {/* Pending queue — the morning-triage list, always in full. */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 32, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Awaiting an Answer</h2>
          {pending.length > 0 && <DotChip label={String(pending.length)} color="#b45309" />}
        </div>
        {pending.length === 0 ? (
          <EmptyState icon="inbox" title="No questions waiting" compact>
            When a customer asks a question on a product page it lands here.
            Write an answer and approve it to publish the Q&amp;A on that product page.
          </EmptyState>
        ) : (
          pending.map(q => (
            <div key={q.id} className="adm-review-row" style={rowStyle}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>{q.author_name}</span>
                  <DotChip label="Pending" color="#b45309" />
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{fmtDate(q.created_at)}</span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: 6 }}>
                  {productLabel(q)}
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>{q.question}</p>

                {/* Answer + approve in one step: approving without an answer is
                    rejected server-side, and the textarea is required here. */}
                <form action={answerQuestion} style={{ marginTop: 12 }}>
                  <input type="hidden" name="id" value={q.id} />
                  <textarea
                    name="answer"
                    required
                    rows={3}
                    placeholder="Write the public answer — it publishes on the product page with the question…"
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '8px 12px',
                      border: '1px solid #d1d5db', borderRadius: 8,
                      fontSize: '0.8125rem', color: '#111827', fontFamily: 'inherit', resize: 'vertical',
                    }}
                  />
                  <div style={{ marginTop: 8 }}>
                    <button type="submit" className="adm-btn adm-btn-primary">Answer &amp; approve</button>
                  </div>
                </form>
              </div>
              <div className="adm-review-actions" style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <form action={rejectQuestion}>
                  <input type="hidden" name="id" value={q.id} />
                  <button type="submit" className="adm-btn adm-btn-danger">Reject</button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Published Q&As — what's live on the PDPs right now. */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
            Published Q&amp;As <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '0.875rem' }}>({published.length})</span>
          </h2>
        </div>
        {published.length === 0 ? (
          <EmptyState icon="file" title="Nothing published yet" compact>
            Answered and approved questions appear here — and on their product pages.
          </EmptyState>
        ) : (
          published.map(q => (
            <div key={q.id} className="adm-review-row" style={rowStyle}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>{q.author_name}</span>
                  <DotChip label="Published" color="#15803d" />
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{fmtDate(q.created_at)}</span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: 6 }}>
                  {productLabel(q)}
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>{q.question}</p>
                {q.answer && (
                  <div style={{
                    marginTop: 10, padding: '8px 12px', background: '#fdf2f8',
                    borderLeft: '3px solid #C5286A', borderRadius: '0 8px 8px 0',
                  }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9d174d', marginBottom: 3 }}>
                      Answer{q.answered_at ? ` · ${fmtDate(q.answered_at)}` : ''}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: '#374151', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{q.answer}</p>
                  </div>
                )}
              </div>
              <div className="adm-review-actions" style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <form action={rejectQuestion}>
                  <input type="hidden" name="id" value={q.id} />
                  <button type="submit" className="adm-btn adm-btn-danger">Unpublish</button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
