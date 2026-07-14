// Saved Routine Finder result: /quiz/r/<code>. The durable, shareable form
// of a completed quiz. Renders the same RoutineView as the live results
// screen with product data looked up fresh (unpublished products drop out).
// Codes are unguessable; the page is noindexed since each result is personal.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { pageMeta } from '@/lib/seo';
import { Overline } from '@/components/ui/Overline';
import { RoutineView } from '@/components/quiz/RoutineView';
import { loadRoutine } from '@/app/quiz/actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const routine = await loadRoutine(code);
  return pageMeta({
    title: routine ? routine.headline : 'Saved routine',
    description: 'A personalised product plan from the Yellow Pink Routine Finder, with cash on delivery across Pakistan.',
    path: `/quiz/r/${code}`,
    noIndex: true,
  });
}

export default async function SavedRoutinePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const routine = await loadRoutine(code);
  if (!routine) notFound();

  return (
    <main className="fade-in">
      <section style={{ padding: '56px var(--side)', minHeight: '60vh' }}>
        <div className="container" style={{ maxWidth: 900, margin: '0 auto' }}>
          <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>
            Saved plan · Routine Finder
          </Overline>
          <RoutineView routine={routine} />
        </div>
      </section>
    </main>
  );
}
