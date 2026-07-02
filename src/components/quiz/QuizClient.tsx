'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import posthog from 'posthog-js';
import {
  BRANCHES, questionsFor, resultHeadline,
  type Branch, type QuizAnswers,
} from '@/lib/quiz';
import {
  getQuizRecommendations, recordQuizStart, recordQuizComplete, captureQuizEmail,
} from '@/app/quiz/actions';
import { ProductTile } from '@/components/ui/ProductTile';
import type { Product } from '@/types';

type Phase = 'intro' | 'questions' | 'loading' | 'results';

const card: React.CSSProperties = {
  width: '100%', textAlign: 'left', padding: '16px 18px', borderRadius: 12,
  border: '1px solid var(--line)', background: 'var(--paper)', cursor: 'pointer',
  fontSize: '1rem', color: 'var(--ink-900)', transition: 'border-color 120ms, background 120ms',
};

function capture(name: string, props?: Record<string, unknown>) {
  try { posthog.capture(name, props); } catch { /* posthog not ready, ignore */ }
}

export function QuizClient() {
  const sessionId = useRef<string>('');
  const [phase, setPhase] = useState<Phase>('intro');
  const [branch, setBranch] = useState<Branch | null>(null);
  const [answers, setAnswers] = useState<QuizAnswers | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [picks, setPicks] = useState<Product[]>([]);

  const [email, setEmail] = useState('');
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [emailMsg, setEmailMsg] = useState('');

  const startBranch = (b: Branch) => {
    if (!sessionId.current) sessionId.current = crypto.randomUUID();
    setBranch(b);
    setAnswers({ branch: b });
    setQIndex(0);
    setPhase('questions');
    capture('quiz_started', { branch: b });
    void recordQuizStart(sessionId.current);
  };

  const choose = async (key: string, value: string) => {
    if (!branch || !answers) return;
    const next: QuizAnswers = { ...answers, [key]: value };
    setAnswers(next);
    capture('quiz_answered', { branch, question: key, answer: value });
    const qs = questionsFor(branch);
    if (qIndex < qs.length - 1) {
      setQIndex(qIndex + 1);
      return;
    }
    // Last question answered → compute results.
    setPhase('loading');
    const recs = await getQuizRecommendations(next);
    setPicks(recs);
    setPhase('results');
    capture('quiz_completed', { ...next, recommended: recs.length });
    void recordQuizComplete(sessionId.current, branch, next, recs.map(p => p.id));
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branch) return;
    setEmailState('sending'); setEmailMsg('');
    const res = await captureQuizEmail(sessionId.current, email, branch);
    if (!res.ok) { setEmailState('error'); setEmailMsg(res.error ?? 'Please try again.'); return; }
    setEmailState('done');
    capture('quiz_email_captured', { branch });
  };

  const retake = () => {
    setPhase('intro'); setBranch(null); setAnswers(null); setQIndex(0);
    setPicks([]); setEmail(''); setEmailState('idle');
  };

  // ── Intro: pick a path ────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div style={{ display: 'grid', gap: 14, maxWidth: 520 }}>
        <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 4 }}>
          Answer a couple of quick questions and we&rsquo;ll recommend products picked for you.
        </p>
        {BRANCHES.map(b => (
          <button key={b.value} type="button" onClick={() => startBranch(b.value)} style={card} className="quiz-card">
            <div style={{ fontWeight: 600 }}>{b.label}</div>
            <div className="small-text" style={{ color: 'var(--ink-500)', marginTop: 2 }}>{b.blurb}</div>
          </button>
        ))}
      </div>
    );
  }

  // ── Questions ─────────────────────────────────────────────────────────────
  if (phase === 'questions' && branch) {
    const qs = questionsFor(branch);
    const q = qs[qIndex];
    return (
      <div style={{ maxWidth: 520 }}>
        <div className="small-text" style={{ color: 'var(--ink-500)', marginBottom: 10 }}>
          Step {qIndex + 1} of {qs.length}
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 500, margin: '0 0 18px' }}>{q.prompt}</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {q.options.map(o => (
            <button key={o.value} type="button" onClick={() => choose(q.key, o.value)} style={card} className="quiz-card">
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return <p className="body-text" style={{ color: 'var(--ink-500)' }}>Finding your matches…</p>;
  }

  // ── Results ───────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.625rem', fontWeight: 500, margin: '0 0 6px' }}>
        {answers ? resultHeadline(answers) : 'Your picks'}
      </h2>
      <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 24 }}>
        {/* Real apostrophes, not &rsquo; entities: these are JS string
            expressions, so React escapes them and an entity renders as
            literal "&rsquo;" text. (Entities are only decoded in JSX text.) */}
        {picks.length > 0
          ? 'Based on your answers, here’s what we’d start with:'
          : 'We couldn’t find an exact match, browse the full range instead:'}
      </p>

      {picks.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 20, marginBottom: 28 }}>
          {picks.map(p => <ProductTile key={p.id} product={p} />)}
        </div>
      )}

      {/* Email opt-in (optional) */}
      {emailState === 'done' ? (
        <div role="status" style={{ padding: '16px 18px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, color: '#166534', marginBottom: 20 }}>
          ✓ Sent! Check your inbox for your results and a welcome discount.
        </div>
      ) : (
        <form onSubmit={submitEmail} style={{ padding: '18px 20px', background: 'var(--paper2)', border: '1px solid var(--line)', borderRadius: 12, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Want these emailed to you, with a welcome discount?</div>
          <p className="small-text" style={{ color: 'var(--ink-500)', margin: '0 0 12px' }}>We&rsquo;ll send your picks and a one-time code. No spam.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="email" inputMode="email" autoComplete="email" required value={email}
              onChange={e => setEmail(e.target.value)} disabled={emailState === 'sending'}
              placeholder="you@example.com"
              style={{ flex: '1 1 220px', minWidth: 0, padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 8, fontSize: '0.9375rem', outline: 'none', background: '#fff' }}
            />
            <button type="submit" disabled={emailState === 'sending'} className="btn-primary" style={{ padding: '11px 20px' }}>
              {emailState === 'sending' ? 'Sending…' : 'Email my results'}
            </button>
          </div>
          {emailState === 'error' && <p role="alert" style={{ color: 'var(--error)', fontSize: '0.8125rem', margin: '8px 0 0' }}>{emailMsg}</p>}
        </form>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/shop" className="btn-primary" style={{ padding: '11px 22px' }}>Shop all products</Link>
        <button type="button" onClick={retake} style={{ padding: '11px 22px', background: 'none', border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer', fontWeight: 600, color: 'var(--ink-700)' }}>
          Retake quiz
        </button>
      </div>
    </div>
  );
}
