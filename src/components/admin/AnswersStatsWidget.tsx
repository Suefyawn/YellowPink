import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { FREE_TOOLS } from '@/lib/free-tools';

// Dashboard widget: Quick Answers engagement, read from the cached PostHog
// panel (analytics_cache key 'posthog_answers', refreshed by the analytics
// cron). Per answer: page traffic, completed calculations, and the view→use
// rate; plus how many answer-users went on to purchase inside the window.

interface AnswersCache {
  usage?: { answer: string; uses: number; users: number }[];
  views?: { path: string; views: number; uniques: number }[];
  converters?: number;
}

// answer_used event keys → the registry entry (for friendly names + hrefs).
const ANSWER_META: Record<string, { href: string }> = {
  'due-date': { href: '/pregnancy-calculator' },
  ovulation: { href: '/ovulation-calculator' },
  bmi: { href: '/bmi-calculator' },
  calorie: { href: '/calorie-calculator' },
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
    };
  });
  const totalUses = rows.reduce((s, r) => s + r.uses, 0);
  const hubViews = viewsByPath.get('/answers')?.views ?? 0;

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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '14px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: '0.8125rem', color: '#6b7280' }}>
            <span><strong style={{ color: '#111827' }}>{hubViews.toLocaleString()}</strong> hub page views</span>
            <span><strong style={{ color: '#111827' }}>{totalUses.toLocaleString()}</strong> calculations in total</span>
            <span><strong style={{ color: '#15803d' }}>{(cache.converters ?? 0).toLocaleString()}</strong> visitors used an answer and then purchased</span>
          </div>
        </>
      )}
    </div>
  );
}
