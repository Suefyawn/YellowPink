import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { FREE_TOOLS } from '@/lib/free-tools';
import { recFor } from '@/lib/answer-recs';

// Dashboard widget: Quick Answers engagement, read from the cached PostHog
// panel (analytics_cache key 'posthog_answers', refreshed by the analytics
// cron). Per answer: page traffic, completed calculations, the view→use
// rate, and clicks on the product recommendation each result shows; plus
// how many answer-users (and rec-clickers) went on to purchase.

interface AnswersCache {
  usage?: { answer: string; uses: number; users: number }[];
  views?: { path: string; views: number; uniques: number }[];
  converters?: number;
  recClicks?: { answer: string; case: string; href: string; clicks: number; users: number }[];
  recConverters?: number;
}

// answer_used event keys → the registry entry (for friendly names + hrefs).
const ANSWER_META: Record<string, { href: string }> = {
  'due-date': { href: '/pregnancy-calculator' },
  ovulation: { href: '/ovulation-calculator' },
  bmi: { href: '/bmi-calculator' },
  calorie: { href: '/calorie-calculator' },
  tdee: { href: '/tdee-calculator' },
  'quiz-fertility': { href: '/fertility-quiz' },
};

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', borderBottom: '1px solid #e5e7eb' };
const td: React.CSSProperties = { padding: '9px 12px', fontSize: '0.8125rem', color: '#111827', borderBottom: '1px solid #f3f4f6' };
const num: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

export async function AnswersStatsWidget() {
  const { data } = await supabaseAdmin()
    .from('analytics_cache')
    .select('data, updated_at')
    .eq('key', 'posthog_answers')
    .maybeSingle();
  const cache = ((data as { data?: AnswersCache } | null)?.data ?? {}) as AnswersCache;
  const usage = cache.usage ?? [];
  const views = cache.views ?? [];
  const recClicks = cache.recClicks ?? [];
  const viewsByPath = new Map(views.map(v => [v.path, v]));

  const rows = FREE_TOOLS.filter(t => t.href !== '/quiz').map(t => {
    const key = Object.entries(ANSWER_META).find(([, m]) => m.href === t.href)?.[0];
    const u = usage.find(x => x.answer === key);
    const v = viewsByPath.get(t.href);
    const uses = u?.uses ?? 0;
    const uniques = v?.uniques ?? 0;
    return {
      name: t.name,
      href: t.href,
      views: v?.views ?? 0,
      uniques,
      uses,
      users: u?.users ?? 0,
      useRate: uniques > 0 ? Math.round(Math.min(100, ((u?.users ?? 0) / uniques) * 100)) : null,
      recClicks: recClicks.filter(r => r.answer === key).reduce((s, r) => s + r.clicks, 0),
    };
  });
  const totalUses = rows.reduce((s, r) => s + r.uses, 0);
  const totalRecClicks = recClicks.reduce((s, r) => s + r.clicks, 0);
  const hubViews = viewsByPath.get('/answers')?.views ?? 0;

  // Friendly labels for the top-clicked list: resolve each answer/case pair
  // back through the rec registry (falls back to the raw href for recs that
  // have since been removed from the registry).
  const topRecs = recClicks.slice(0, 5).map(r => ({
    ...r,
    title: recFor(r.answer, r.case)?.title ?? r.href,
    from: FREE_TOOLS.find(t => t.href === ANSWER_META[r.answer]?.href)?.name ?? r.answer,
  }));

  return (
    <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Quick Answers, last 7 days</h2>
        <Link href="/answers" style={{ fontSize: '0.8125rem', color: '#C5286A', textDecoration: 'none' }}>Open Quick Answers →</Link>
      </div>

      {totalUses === 0 && hubViews === 0 ? (
        <div style={{ padding: '32px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          No activity recorded yet. Numbers appear after the next analytics refresh once visitors start using the answers.
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={th}>Answer</th>
                  <th style={{ ...th, ...num }}>Page views</th>
                  <th style={{ ...th, ...num }}>Visitors</th>
                  <th style={{ ...th, ...num }}>Calculations</th>
                  <th style={{ ...th, ...num }}>Visitors who used it</th>
                  <th style={{ ...th, ...num }}>Product clicks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.href}>
                    <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
                    <td style={{ ...td, ...num }}>{r.views.toLocaleString()}</td>
                    <td style={{ ...td, ...num }}>{r.uniques.toLocaleString()}</td>
                    <td style={{ ...td, ...num }}>{r.uses.toLocaleString()}</td>
                    <td style={{ ...td, ...num }}>{r.useRate != null ? `${r.useRate}%` : '—'}</td>
                    <td style={{ ...td, ...num }}>{r.recClicks.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {topRecs.length > 0 && (
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', marginBottom: 8 }}>
                Most-clicked recommendations
              </div>
              {topRecs.map(r => (
                <div key={`${r.answer}/${r.case}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', fontSize: '0.8125rem' }}>
                  <span style={{ color: '#111827', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.title} <span style={{ color: '#9ca3af' }}>from {r.from}</span>
                  </span>
                  <span style={{ ...num, color: '#111827', fontWeight: 600, flexShrink: 0 }}>
                    {r.clicks.toLocaleString()} {r.clicks === 1 ? 'click' : 'clicks'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ padding: '14px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: '0.8125rem', color: '#6b7280' }}>
            <span><strong style={{ color: '#111827' }}>{hubViews.toLocaleString()}</strong> hub page views</span>
            <span><strong style={{ color: '#111827' }}>{totalUses.toLocaleString()}</strong> calculations in total</span>
            <span><strong style={{ color: '#111827' }}>{totalRecClicks.toLocaleString()}</strong> recommendation clicks</span>
            <span><strong style={{ color: '#15803d' }}>{(cache.converters ?? 0).toLocaleString()}</strong> visitors used an answer and then purchased</span>
            <span><strong style={{ color: '#15803d' }}>{(cache.recConverters ?? 0).toLocaleString()}</strong> clicked a recommendation and then purchased</span>
          </div>
        </>
      )}
    </div>
  );
}
