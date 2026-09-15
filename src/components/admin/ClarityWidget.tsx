import Link from 'next/link';
import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';
import { isClarityConfigured, type ClaritySummary } from '@/lib/clarity';

// Microsoft Clarity, in-app. Reads the 'clarity' analytics_cache blob that
// refreshClarity (dashboard/actions.ts) writes on every analytics refresh.
//
// Why this card exists: the Clarity TAG has been on the storefront since
// 4 Sep, but the frustration signals it records — rage clicks, dead clicks,
// quickbacks, script errors — only lived inside Clarity's own dashboard. They
// are the closest thing the store has to "where checkout loses people", so
// they belong next to Bing and Google rather than in a separate tab nobody
// opens.
//
// Two API limits leak into the UI and cannot be designed away:
//   • The window is a rolling 3 days. There is no historical range, so the
//     caption says "last 3 days" rather than implying the 28-day figure the
//     Bing card shows beside it.
//   • The quota is 10 calls per project per day. There is no per-card refresh
//     button for that reason; the daily analytics refresh spends one call.

type ClarityCache = ClaritySummary & { days: number };

const card: React.CSSProperties = { background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' };
const head: React.CSSProperties = { padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' };

/** Per-1,000-session rate, which is how these signals are actually comparable
 *  day to day — a raw rage-click count rises simply because traffic rose. */
function per1k(count: number, sessions: number): string {
  if (!sessions) return '';
  return `${((count / sessions) * 1000).toFixed(1)} per 1k sessions`;
}

export async function ClarityWidget() {
  if (!isClarityConfigured()) {
    return (
      <div style={{ ...card, padding: '16px 18px' }}>
        <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', marginBottom: 6 }}>Microsoft Clarity</div>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#4b5563', lineHeight: 1.55 }}>
          The Clarity tag is recording sessions, but nothing is reading the numbers back into this page yet.
          To show rage clicks, dead clicks and script errors here: open <strong>clarity.microsoft.com</strong> → your project →{' '}
          <em>Settings → Data export → Generate new API token</em>, then set <code>CLARITY_API_TOKEN</code> in the server environment.
          The project ID (for the tag itself) is on{' '}
          <Link href="/admin/settings/integrations" style={{ color: '#C5286A', fontWeight: 600 }}>Settings → Integrations</Link>.
        </p>
      </div>
    );
  }

  const cached = await readAnalyticsCache<ClarityCache>('clarity');
  if (!cached) {
    return (
      <div style={{ ...card, padding: '16px 18px' }}>
        <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', marginBottom: 6 }}>Microsoft Clarity</div>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#4b5563' }}>Connected. The first numbers appear after the next analytics refresh (daily at 09:00 PKT, or the Refresh button above).</p>
      </div>
    );
  }

  const d = cached.data;
  const seen = (name: string) => d.metricsSeen?.includes(name) ?? false;

  return (
    <div style={card}>
      <div style={head}>
        <div>
          <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem' }}>Microsoft Clarity</div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            last {d.days} {d.days === 1 ? 'day' : 'days'} (the API keeps no longer history) · updated {timeAgoShort(cached.updatedAt)}
          </div>
        </div>
        <a href="https://clarity.microsoft.com/projects" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#C5286A', fontWeight: 600 }}>Watch session recordings ↗</a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, padding: '14px 18px' }}>
        <Stat label="Sessions" value={d.sessions} sub={d.botSessions ? `${d.botSessions.toLocaleString()} bot sessions excluded` : undefined} />
        <Stat label="Distinct users" value={d.distinctUsers} />
        <Stat label="Pages / session" value={d.pagesPerSession ?? 0} decimals={2} />
      </div>

      <div style={{ padding: '0 18px 4px', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', fontWeight: 600 }}>
        Frustration signals
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, padding: '8px 18px 16px' }}>
        <Signal label="Rage clicks" value={d.rageClicks} sessions={d.sessions} reported={seen('RageClickCount')} />
        <Signal label="Dead clicks" value={d.deadClicks} sessions={d.sessions} reported={seen('DeadClickCount')} />
        <Signal label="Quickbacks" value={d.quickbackClicks} sessions={d.sessions} reported={seen('QuickbackClick')} />
        <Signal label="Excessive scroll" value={d.excessiveScroll} sessions={d.sessions} reported={seen('ExcessiveScroll')} />
        <Signal label="Script errors" value={d.scriptErrors} sessions={d.sessions} reported={seen('ScriptErrorCount')} />
        <Signal label="Error clicks" value={d.errorClicks} sessions={d.sessions} reported={seen('ErrorClickCount')} />
      </div>

      <div style={{ margin: '0 18px 16px', padding: '8px 12px', background: '#faf6ee', borderRadius: 8, fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5 }}>
        A <strong>rage click</strong> is repeated clicking in one spot, a <strong>dead click</strong> is a click that does nothing, and a{' '}
        <strong>quickback</strong> is opening a page and immediately going back. Any of them rising on a checkout or product page is
        usually a broken control, not impatience. Open the recordings to see the session itself.
        A dash means Clarity returned that metric but not in a form this page can read; the raw
        response is stored with the snapshot so it can be pinned down.
      </div>
    </div>
  );
}

/** A frustration signal has THREE states, not two, and conflating them is how
 *  the card first shipped showing the session count as the rage-click count:
 *
 *    value = a number  → Clarity reported it and it parsed
 *    value = null      → Clarity returned the metric but its field name is
 *                        undocumented and could not be read; show a dash,
 *                        never a number
 *    reported = false  → Clarity did not return the metric at all
 *
 *  A dash is the honest answer for the middle case. A zero would read as
 *  "no rage clicks", which is a claim we cannot make. */
function Signal({ label, value, sessions, reported }: { label: string; value: number | null; sessions: number; reported: boolean }) {
  if (!reported) return <Stat label={label} value={0} sub="not reported by Clarity" muted />;
  if (value === null) return <Stat label={label} value={null} sub="value not readable" muted />;
  return <Stat label={label} value={value} sub={per1k(value, sessions)} warn={value > 0} />;
}

function Stat({ label, value, sub, warn, muted, decimals = 0 }: { label: string; value: number | null; sub?: string; warn?: boolean; muted?: boolean; decimals?: number }) {
  return (
    <div style={{ padding: '10px 12px', background: '#faf6ee', borderRadius: 8 }}>
      <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '1.375rem', fontWeight: 700, color: muted ? '#9ca3af' : warn ? '#b45309' : '#111827', fontVariantNumeric: 'tabular-nums' }}>
        {value === null || muted
          ? '—'
          : value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      </div>
      {sub ? <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>{sub}</div> : null}
    </div>
  );
}
