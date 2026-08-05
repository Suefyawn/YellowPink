'use client';

// Four questions, one at a time, and the answer pattern picks ONE next step
// (lib/answer-recs case). No personal data leaves the browser; only the
// completion and the resulting case are captured for the admin panel.

import { useState } from 'react';
import posthog from 'posthog-js';
import Link from 'next/link';
import { recFor } from '@/lib/answer-recs';
import { AnswerRecCard } from './AnswerRec';

type Case = 'timing' | 'pcos' | 'male' | 'couple';

const QUESTIONS = [
  {
    key: 'trying',
    text: 'How long have you been trying for a baby?',
    options: ['Less than 6 months', '6 to 12 months', 'More than a year'],
  },
  {
    key: 'cycles',
    text: 'Are your periods regular? (Every 24 to 35 days, roughly predictable)',
    options: ['Yes, regular', 'No, irregular or often late', 'Not sure'],
  },
  {
    key: 'signs',
    text: 'Do any of these apply to you?',
    options: ['Stubborn acne or excess facial hair', 'Weight that clings around the middle', 'None of these'],
  },
  {
    key: 'partner',
    text: 'Has your husband had a semen analysis (sperm test)?',
    options: ['Yes, it was normal', 'Yes, an issue was found', 'Not yet'],
  },
] as const;

const RESULT_COPY: Record<Case, { heading: string; body: string; doctor?: string }> = {
  timing: {
    heading: 'Your pattern points to timing, and timing is fixable.',
    body: 'Nothing in your answers suggests a medical barrier. Most couples in your position simply miss the fertile window: there are only about two strong days each cycle, and they are earlier or later than most people guess. Pin them down precisely and give it a few well-timed cycles.',
  },
  pcos: {
    heading: 'Your answers fit a hormonal pattern worth checking.',
    body: 'Irregular cycles, especially alongside acne, excess hair or central weight, most often trace back to PCOS, and PCOS is manageable: many women conceive once ovulation is restored. Myo-inositol has the best evidence among supplements, and cycle tracking still helps on the cycles you do ovulate.',
    doctor: 'A gynaecologist can confirm the picture with an ultrasound and a short blood panel. Our PCOS guide explains what to expect.',
  },
  male: {
    heading: 'Work the side where an issue is already known.',
    body: 'Since a semen analysis found something, that is the highest-value place to act: sperm renews every 72 days, so improvements in diet, sleep, heat exposure and targeted supplementation show up within about three months. Keep timing right on her side meanwhile.',
    doctor: 'Share the analysis report with a urologist or fertility specialist; many findings are very treatable.',
  },
  couple: {
    heading: 'A year of trying has earned proper answers.',
    body: 'After twelve months, guessing costs more than testing. The standard first round is simple: a semen analysis for him, and cycle bloods plus an ultrasound for her. Working both sides at once, supplements included, saves the months that matter most.',
    doctor: 'Book a fertility clinic visit rather than waiting longer; our infertility and IVF guide explains the pathway and costs in Pakistan.',
  },
};

function resolveCase(answers: number[]): Case {
  const [trying, cycles, signs, partner] = answers;
  if (partner === 1) return 'male';
  if (cycles === 1 || signs === 0 || signs === 1) return 'pcos';
  if (trying === 2) return 'couple';
  return 'timing';
}

export function FertilityQuiz() {
  const [answers, setAnswers] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const step = answers.length;

  function pick(i: number) {
    const next = [...answers, i];
    setAnswers(next);
    if (next.length === QUESTIONS.length) {
      setDone(true);
      try {
        posthog.capture('answer_used', { answer: 'quiz-fertility', case: resolveCase(next) });
      } catch { /* posthog not ready */ }
    }
  }

  function restart() { setAnswers([]); setDone(false); }

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
    padding: 'clamp(20px, 4vw, 32px)',
  };

  if (!done) {
    const q = QUESTIONS[step];
    return (
      <div key={step} className="qz-step" style={{ ...card, ['--qz-accent' as never]: '#8b2fa1' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }} aria-hidden="true">
          {QUESTIONS.map((_, i) => (
            <span key={i} style={{ flex: 1, height: 5, borderRadius: 99, background: i < step ? '#8b2fa1' : i === step ? '#d8b4e2' : 'var(--line)' }} />
          ))}
        </div>
        <p className="small-text" style={{ margin: '0 0 6px', color: 'var(--ink-500)' }}>Question {step + 1} of {QUESTIONS.length}</p>
        <p style={{ margin: '0 0 16px', fontWeight: 700, fontSize: '1.0625rem' }}>{q.text}</p>
        <div style={{ display: 'grid', gap: 10 }}>
          {q.options.map((opt, i) => (
            <button key={opt} type="button" onClick={() => pick(i)} className="qz-option" style={{
              textAlign: 'left', padding: '13px 16px', borderRadius: 10, border: '1.5px solid var(--line)',
              background: 'var(--paper2, #faf6ee)', font: 'inherit', cursor: 'pointer',
            }}>
              {opt}
            </button>
          ))}
        </div>
        {step > 0 && (
          <button type="button" onClick={() => setAnswers(answers.slice(0, -1))} className="small-text"
            style={{ marginTop: 14, background: 'none', border: 'none', color: 'var(--ink-500)', cursor: 'pointer', padding: 0 }}>
            ← Back
          </button>
        )}
      </div>
    );
  }

  const c = resolveCase(answers);
  const copy = RESULT_COPY[c];
  const rec = recFor('quiz-fertility', c);
  return (
    <div className="qz-step" style={card}>
      <p className="small-text" style={{ margin: '0 0 6px', fontWeight: 700, color: '#8b2fa1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your result</p>
      <p style={{ margin: '0 0 10px', fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 600 }}>{copy.heading}</p>
      <p className="body-text" style={{ margin: 0, color: 'var(--ink-700)' }}>{copy.body}</p>
      {copy.doctor && (
        <p className="body-text" style={{ margin: '10px 0 0', color: 'var(--ink-700)' }}>{copy.doctor}</p>
      )}
      {rec && <AnswerRecCard rec={rec} tint="#f6eefb" accent="#8b2fa1" />}
      <p className="small-text" style={{ color: 'var(--ink-500)', margin: '16px 0 0' }}>
        Helpful next reads: the <Link href="/blog/how-to-get-pregnant-trying-to-conceive-pakistan">trying-to-conceive guide</Link>,{' '}
        the <Link href="/ovulation-calculator">Fertile Days Finder</Link>
        {c === 'pcos' && <>, and the <Link href="/blog/pcos-symptoms-causes-treatment-pakistan">PCOS guide</Link></>}
        {c === 'couple' && <>, and the <Link href="/blog/infertility-causes-ivf-pakistan-guide">infertility and IVF guide</Link></>}.
        This quiz is guidance, not a diagnosis.
      </p>
      <button type="button" onClick={restart} className="small-text"
        style={{ marginTop: 14, background: 'none', border: 'none', color: 'var(--ink-500)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
        Start over
      </button>
    </div>
  );
}
