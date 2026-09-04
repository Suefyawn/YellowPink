import Link from 'next/link';
import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';
import { isBingConfigured } from '@/lib/bing';

// Bing Webmaster Tools, in-app. Reads the 'bing' analytics_cache blob that
// refreshBing (dashboard/actions.ts) writes on every analytics refresh:
// 28-day clicks/impressions with the prior-28 comparison, top queries, top
// pages, crawl health and the URL-submission quota. Sits under Analytics →
// Search & discovery beside the Google dashboard so staff read both engines
// in one place. Without the API key it explains the two-minute setup.

interface BingCache {
  site: string;
  range: { start: string; end: string } | null;
  totals: { clicks: number; impressions: number };
  previous: { clicks: number; impressions: number };
  queries: Array<{ query: string; clicks: number; impressions: number; avgPosition: number | null }>;
  pages: Array<{ url: string; clicks: number; impressions: number; avgPosition: number | null }>;
  crawl: { day: string; crawledPages: number; inIndex: number; crawlErrors: number; blockedByRobots: number; http4xx: number; http5xx: number } | null;
  quota: { daily: number; monthly: number } | null;
  failures: string[];
}

const card: React.CSSProperties = { background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' };
const head: React.CSSProperties = { padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' };
const th: React.CSSProperties = { textAlign: 'left', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', fontWeight: 600, padding: '6px 0' };
const td: React.CSSProperties = { fontSize: '0.8125rem', color: '#374151', padding: '6px 0', borderTop: '1px solid #f9fafb' };
const num: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

function delta(now: number, prev: number): string {
  if (!prev) return now ? 'new' : '';
  const pct = Math.round(((now - prev) / prev) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}% vs prior 28d`;
}

function pathOf(url: string): string {
  try { return new URL(url).pathname || '/'; } catch { return url; }
}

export async function BingSearchWidget() {
  if (!isBingConfigured()) {
    return (
      <div style={{ ...card, padding: '16px 18px' }}>
        <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', marginBottom: 6 }}>Bing Webmaster Tools</div>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#4b5563', lineHeight: 1.55 }}>
          Not connected yet. Bing feeds DuckDuckGo, Yahoo and Copilot answers, and IndexNow already submits every new page to it.
          To see Bing queries, pages and crawl health here: in <strong>Bing Webmaster Tools</strong> add the site (fastest: <em>Import from Google Search Console</em>),
          then <em>Settings → API access → Generate API key</em>, and set <code>BING_WEBMASTER_API_KEY</code> in Vercel. Status and the verification field are on{' '}
          <Link href="/admin/settings/integrations" style={{ color: '#C5286A', fontWeight: 600 }}>Settings → Integrations</Link>.
        </p>
      </div>
    );
  }

  const cached = await readAnalyticsCache<BingCache>('bing');
  if (!cached) {
    return (
      <div style={{ ...card, padding: '16px 18px' }}>
        <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', marginBottom: 6 }}>Bing Webmaster Tools</div>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#4b5563' }}>Connected. The first numbers appear after the next analytics refresh (daily at 09:00 PKT, or the Refresh button above).</p>
      </div>
    );
  }
  const d = cached.data;
  const topQueries = d.queries.slice(0, 10);
  const topPages = d.pages.slice(0, 8);

  return (
    <div style={card}>
      <div style={head}>
        <div>
          <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem' }}>Bing Webmaster Tools</div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            {d.range ? `${d.range.start} to ${d.range.end}` : 'last 28 days'} · Bing, DuckDuckGo, Yahoo, Copilot · updated {timeAgoShort(cached.updatedAt)}
          </div>
        </div>
        <a href="https://www.bing.com/webmasters" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#C5286A', fontWeight: 600 }}>Open Bing Webmaster ↗</a>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, padding: '14px 18px' }}>
        <Stat label="Clicks" value={d.totals.clicks} sub={delta(d.totals.clicks, d.previous.clicks)} />
        <Stat label="Impressions" value={d.totals.impressions} sub={delta(d.totals.impressions, d.previous.impressions)} />
        <Stat label="Pages in index" value={d.crawl?.inIndex ?? 0} sub={d.crawl ? `crawled ${d.crawl.crawledPages} on ${d.crawl.day}` : ''} />
        <Stat label="Crawl errors" value={d.crawl?.crawlErrors ?? 0} sub={d.crawl ? `${d.crawl.http4xx} × 4xx, ${d.crawl.http5xx} × 5xx, ${d.crawl.blockedByRobots} blocked` : ''} warn={(d.crawl?.crawlErrors ?? 0) > 0} />
        <Stat label="Submission quota" value={d.quota?.daily ?? 0} sub={d.quota ? `URLs left today · ${d.quota.monthly} this month` : ''} />
      </div>
      {d.failures.length > 0 && (
        <div style={{ margin: '0 18px 12px', padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: '0.75rem', color: '#92400e' }}>
          Some Bing reports failed on the last refresh: {d.failures.join('; ')}
        </div>
      )}
      <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18, padding: '0 18px 16px' }}>
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Top queries</th><th style={{ ...th, textAlign: 'right' }}>Impr.</th><th style={{ ...th, textAlign: 'right' }}>Clicks</th><th style={{ ...th, textAlign: 'right' }}>Pos.</th></tr></thead>
            <tbody>
              {topQueries.length === 0 && <tr><td style={{ ...td, color: '#9ca3af' }} colSpan={4}>No query data yet</td></tr>}
              {topQueries.map(q => (
                <tr key={q.query}>
                  <td style={td}>{q.query}</td>
                  <td style={num}>{q.impressions.toLocaleString()}</td>
                  <td style={num}>{q.clicks.toLocaleString()}</td>
                  <td style={num}>{q.avgPosition != null ? q.avgPosition.toFixed(1) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Top pages</th><th style={{ ...th, textAlign: 'right' }}>Impr.</th><th style={{ ...th, textAlign: 'right' }}>Clicks</th></tr></thead>
            <tbody>
              {topPages.length === 0 && <tr><td style={{ ...td, color: '#9ca3af' }} colSpan={3}>No page data yet</td></tr>}
              {topPages.map(p => (
                <tr key={p.url}>
                  <td style={{ ...td, wordBreak: 'break-all' }}>{pathOf(p.url)}</td>
                  <td style={num}>{p.impressions.toLocaleString()}</td>
                  <td style={num}>{p.clicks.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: number; sub?: string; warn?: boolean }) {
  return (
    <div style={{ padding: '10px 12px', background: '#faf6ee', borderRadius: 8 }}>
      <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '1.375rem', fontWeight: 700, color: warn ? '#b45309' : '#111827', fontVariantNumeric: 'tabular-nums' }}>{value.toLocaleString()}</div>
      {sub ? <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>{sub}</div> : null}
    </div>
  );
}
