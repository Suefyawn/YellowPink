// Quiz call-to-action for blog posts — the discovery fix for a conversion
// machine nobody finds: only 5 shoppers reached /quiz in 90 days, yet all 5
// finished it and 40% added to cart afterwards (12x the site rate). Blog
// posts are the store's biggest entry surface, so this sits after each
// article's FAQ. The homepage already has its own QuizBand section; this
// component is the slim in-article variant. Server-renderable, no state; the
// ?src= param tags the entry surface so PostHog pageviews on /quiz attribute
// which placement works.

import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';

export function QuizCtaBand({ source = 'blog' }: { source?: string }) {
  return (
    <aside
      style={{
        margin: '36px 0 0', padding: '20px 22px',
        background: 'var(--paper2, #faf6ee)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-card)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 220, flex: 1 }}>
        <Overline style={{ display: 'block', marginBottom: 4, color: 'var(--brand-pink-text)' }}>
          Not sure what suits you?
        </Overline>
        <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
          Answer a few questions and get a routine picked from what we stock.
        </p>
        <p className="small-text" style={{ margin: '4px 0 0', color: 'var(--ink-700)' }}>
          Takes about two minutes. No email needed.
        </p>
      </div>
      <Link
        href={`/quiz?src=${encodeURIComponent(source)}`}
        style={{
          display: 'inline-block', padding: '12px 26px',
          background: 'var(--brand-pink-cta, #C5286A)', color: '#fff',
          borderRadius: 'var(--radius-pill)', textDecoration: 'none',
          fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 700,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}
      >
        Take the quiz
      </Link>
    </aside>
  );
}
