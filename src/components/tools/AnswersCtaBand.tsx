// "Check it for yourself" band under health articles: the Quick Answers
// matched to the post's category (Due Date Finder under fertility posts,
// Daily Calorie Check under wellness posts, and so on). Beauty posts keep
// the existing quiz band instead; this renders nothing when no calculator
// matches the category.

import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ToolCards } from '@/components/tools/ToolCards';
import { answersForCategory } from '@/lib/free-tools';

export function AnswersCtaBand({ category }: { category: string | null | undefined }) {
  const answers = answersForCategory(category).filter(t => t.href !== '/quiz');
  if (answers.length === 0) return null;
  return (
    <section style={{ padding: '0 var(--side) 40px' }}>
      <div className="container" style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ background: 'var(--paper2, #faf6ee)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 'clamp(20px, 4vw, 28px)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '4px 16px', marginBottom: 14 }}>
            <Overline style={{ color: 'var(--ink-500)' }}>Check it for yourself</Overline>
            <Link href="/answers" className="text-link" style={{ fontSize: '0.8125rem' }}>All Quick Answers</Link>
          </div>
          <ToolCards compact tools={answers} />
        </div>
      </div>
    </section>
  );
}
