// Homepage band surfacing the free tools. Value-first by design: the tools
// answer real questions (due date, fertile days, healthy weight, calories,
// skincare routine) and earn the visit; the shop earns the follow-on click.

import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ToolCards } from '@/components/tools/ToolCards';

export function ToolsBand() {
  return (
    <section style={{ padding: 'var(--section-gap) 0', background: 'var(--paper2, #faf6ee)' }}>
      <div className="container">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '4px 16px', marginBottom: 20 }}>
          <div>
            <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Free tools</Overline>
            <h2 className="display-l" style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2rem)', margin: 0 }}>
              Quick answers, no signup.
            </h2>
          </div>
          <Link href="/tools" className="text-link">All tools</Link>
        </div>
        <ToolCards compact />
      </div>
    </section>
  );
}
