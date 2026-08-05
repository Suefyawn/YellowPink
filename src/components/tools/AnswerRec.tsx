'use client';

// The funnel's single gentle suggestion: one card under a calculator/quiz
// result, chosen by that result's case (lib/answer-recs). Click fires
// 'answer_rec_clicked' so the admin Quick Answers panel can trace result →
// click → purchase. Never more than one card per result (house rule).

import Image from 'next/image';
import Link from 'next/link';
import posthog from 'posthog-js';
import type { AnswerRec } from '@/lib/answer-recs';

export function AnswerRecCard({ rec, tint = '#fdf2f8', accent = '#be185d' }: {
  rec: AnswerRec; tint?: string; accent?: string;
}) {
  function onClick() {
    try {
      posthog.capture('answer_rec_clicked', { answer: rec.answer, case: rec.case, href: rec.href });
    } catch { /* posthog not ready */ }
  }
  return (
    <div style={{
      marginTop: 18, padding: '14px 16px', borderRadius: 12, background: tint,
      border: '1px solid rgba(0,0,0,0.05)', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap',
    }}>
      {rec.image && (
        <Image src={rec.image} alt={rec.title} width={64} height={64}
          style={{ borderRadius: 10, objectFit: 'cover', background: '#fff', flex: '0 0 auto' }} />
      )}
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <p className="small-text" style={{ margin: 0, fontWeight: 700 }}>{rec.title}</p>
        <p className="small-text" style={{ margin: '4px 0 0', color: 'var(--ink-700)' }}>{rec.reason}</p>
      </div>
      <Link href={rec.href} onClick={onClick} className="small-text" style={{
        flex: '0 0 auto', fontWeight: 700, color: accent, textDecoration: 'none',
        border: `1.5px solid ${accent}`, borderRadius: 100, padding: '7px 16px', whiteSpace: 'nowrap',
      }}>
        {rec.cta} →
      </Link>
    </div>
  );
}
