'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import posthog from 'posthog-js';
import {
  BRANCHES, questionsFor, type Branch, type QuizAnswers,
} from '@/lib/quiz';
import {
  buildRoutine, recordQuizStart, recordQuizComplete,
  type RoutineResult,
} from '@/app/quiz/actions';
import { RoutineView } from '@/components/quiz/RoutineView';

type Phase = 'intro' | 'questions' | 'loading' | 'results';

const card: React.CSSProperties = {
  width: '100%', textAlign: 'left', padding: '16px 18px', borderRadius: 12,
  border: '1px solid var(--line)', background: 'var(--paper)', cursor: 'pointer',
  fontSize: '1rem', color: 'var(--ink-900)', transition: 'border-color 120ms, background 120ms',
};

/** Lucide-style branch icons for the intro panels (24×24, currentColor,
 *  strokeWidth 2, never emoji): sparkles for the beauty path, heart-pulse
 *  for wellness. */
function BranchIcon({ branch }: { branch: Branch }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {branch === 'skincare' ? (
        <>
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          <path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" />
        </>
      ) : (
        <>
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
          <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
        </>
      )}
    </svg>
  );
}

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
);

function capture(name: string, props?: Record<string, unknown>) {
  try { posthog.capture(name, props); } catch { /* posthog not ready, ignore */ }
}

export function QuizClient() {
  const sessionId = useRef<string>('');
  const [phase, setPhase] = useState<Phase>('intro');
  const [branch, setBranch] = useState<Branch | null>(null);
  const [answers, setAnswers] = useState<QuizAnswers | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [routine, setRoutine] = useState<RoutineResult | null>(null);

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
    // Recompute against the NEW answers: the wellness follow-up question only
    // exists once the goal is chosen.
    const qs = questionsFor(branch, next);
    if (qIndex < qs.length - 1) {
      setQIndex(qIndex + 1);
      return;
    }
    setPhase('loading');
    const result = await buildRoutine(next);
    setRoutine(result);
    setPhase('results');
    const ids = result?.sections.flatMap(s => s.picks.map(p => p.product.id)) ?? [];
    capture('quiz_completed', { ...next, recommended: ids.length, result_code: result?.code });
    void recordQuizComplete(sessionId.current, branch, next, ids);
  };

  const retake = () => {
    setPhase('intro'); setBranch(null); setAnswers(null); setQIndex(0);
    setRoutine(null);
  };

  // ── Intro: pick a path ────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div>
        <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 24 }}>
          Answer a couple of quick questions and get a step-by-step plan built from
          products we actually stock, with the reason behind every pick.
        </p>
        <div className="quiz-branch-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {BRANCHES.map(b => (
            <button
              key={b.value}
              type="button"
              onClick={() => startBranch(b.value)}
              className="quiz-branch-panel"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12,
                textAlign: 'left', minHeight: 210, padding: '26px 24px',
                background: '#fff', border: '1px solid var(--line)', borderRadius: 12,
                cursor: 'pointer', color: 'var(--ink-900)',
                transition: 'border-color 180ms ease-out, transform 180ms ease-out, box-shadow 180ms ease-out',
              }}
            >
              <span aria-hidden="true" style={{
                width: 44, height: 44, borderRadius: '50%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: b.value === 'skincare' ? '#F9E4ED' : 'var(--brand-yellow-soft, #fdf2cc)',
                color: b.value === 'skincare' ? 'var(--brand-pink-text, #C5286A)' : 'var(--ink-900)',
              }}>
                <BranchIcon branch={b.value} />
              </span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                {b.label}
              </span>
              <span className="small-text" style={{ color: 'var(--ink-500)' }}>{b.blurb}</span>
              <span style={{
                marginTop: 'auto', paddingTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
                color: 'var(--brand-pink-text, #C5286A)', fontWeight: 600, fontSize: '0.875rem',
              }}>
                Start
                <ArrowRightIcon />
              </span>
            </button>
          ))}
        </div>
        {/* !important: the panel declares its resting border inline, and
            important stylesheet rules are what beat inline styles (same
            pattern as .wellness-concern:hover in globals.css). */}
        <style>{`
          .quiz-branch-panel:hover, .quiz-branch-panel:focus-visible {
            border-color: var(--brand-pink-text, #C5286A) !important;
            transform: translateY(-2px);
            box-shadow: 0 8px 22px rgba(197, 40, 106, 0.08);
          }
          @media (max-width: 600px) {
            .quiz-branch-grid { grid-template-columns: 1fr !important; }
            .quiz-branch-panel { min-height: 0 !important; }
          }
        `}</style>
      </div>
    );
  }

  // ── Questions ─────────────────────────────────────────────────────────────
  if (phase === 'questions' && branch && answers) {
    const qs = questionsFor(branch, answers);
    const q = qs[qIndex];
    // Both flows are two steps end-to-end; the wellness follow-up only enters
    // `qs` after the goal is chosen, so display the known total, not qs.length.
    const total = 2;
    return (
      <div style={{ maxWidth: 520 }}>
        <div className="small-text" style={{ color: 'var(--ink-500)', marginBottom: 10 }}>
          Step {qIndex + 1} of {total}
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
    return <p className="body-text" style={{ color: 'var(--ink-500)' }}>Building your plan…</p>;
  }

  // ── Results ───────────────────────────────────────────────────────────────
  if (!routine) {
    return (
      <div style={{ maxWidth: 560 }}>
        <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 20 }}>
          We could not build a match from your answers right now. Browse the full
          range instead, or try a different path.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/shop" className="btn-primary" style={{ padding: '11px 22px' }}>Shop all products</Link>
          <button type="button" onClick={retake} style={{ padding: '11px 22px', background: 'none', border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer', fontWeight: 600, color: 'var(--ink-700)' }}>
            Retake quiz
          </button>
        </div>
      </div>
    );
  }

  return <RoutineView routine={routine} onRetake={retake} />;
}
