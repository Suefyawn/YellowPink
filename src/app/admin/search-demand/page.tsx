export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getStaffSession } from '@/lib/staff-auth';
import { can, canAny } from '@/lib/permissions';
import { NoAccess } from '@/components/admin/NoAccess';
import { getSearchDemand, type GscRow, type OnsiteRow } from './actions';
import { fmtDatePK } from '@/lib/dates';

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '9px 12px', fontSize: '0.8125rem', color: '#111827', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' };
const num: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

// What a viewer may spin up straight from a demand row. Both are permission-
// gated so a read-only analyst sees the numbers without the create buttons.
interface Acts { product: boolean; guide: boolean }

const actBtn: React.CSSProperties = { fontSize: '0.6875rem', fontWeight: 600, padding: '3px 9px', borderRadius: 999, textDecoration: 'none', whiteSpace: 'nowrap', border: '1px solid transparent' };
const actProduct: React.CSSProperties = { ...actBtn, background: '#fdf2f8', color: '#9d174d', borderColor: '#fbcfe8' };
const actGuide: React.CSSProperties = { ...actBtn, background: '#f9fafb', color: '#374151', borderColor: '#e5e7eb' };

// One-click "act on this demand": seed a new product / guide with the term.
// The forms read ?name= / ?title= and pre-fill, so the owner lands on a
// half-started draft instead of a blank page.
function RowActions({ term, acts, guideOnly = false }: { term: string; acts: Acts; guideOnly?: boolean }) {
  const t = encodeURIComponent(term.slice(0, 120));
  return (
    <span style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      {!guideOnly && acts.product && <Link href={`/admin/products/new?name=${t}`} style={actProduct}>+ Product</Link>}
      {acts.guide && <Link href={`/admin/blog/new?title=${t}`} style={actGuide}>+ Guide</Link>}
    </span>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid #f3f4f6' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{title}</h2>
        <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>{subtitle}</p>
      </div>
      <div style={{ overflowX: 'auto' }}>{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, padding: '18px', fontSize: '0.8125rem', color: '#9ca3af' }}>{children}</p>;
}

function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }
function pos(n: number) { return n.toFixed(1); }

function GscTable({ rows, acts }: { rows: GscRow[]; acts: Acts }) {
  const showActs = acts.guide; // GSC demand feeds guides, not new products
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
      <thead><tr>
        <th style={th}>Search term</th>
        <th style={{ ...th, textAlign: 'right' }}>Impressions</th>
        <th style={{ ...th, textAlign: 'right' }}>Position</th>
        <th style={{ ...th, textAlign: 'right' }}>Clicks</th>
        <th style={{ ...th, textAlign: 'right' }}>CTR</th>
        {showActs && <th style={{ ...th, textAlign: 'right' }}>Act</th>}
      </tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={td}>{r.query}</td>
            <td style={num}>{r.impressions}</td>
            <td style={num}>{pos(r.position)}</td>
            <td style={num}>{r.clicks}</td>
            <td style={num}>{pct(r.ctr)}</td>
            {showActs && <td style={num}><RowActions term={r.query} acts={acts} guideOnly /></td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function resultBadge(results: number) {
  if (results === 0) return <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>No results</span>;
  if (results > 0 && results <= 2) return <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>Only {results}</span>;
  if (results < 0) return <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>—</span>;
  return <span style={{ fontSize: '0.8125rem', color: '#059669' }}>{results}+</span>;
}

function OnsiteTable({ rows, acts }: { rows: OnsiteRow[]; acts: Acts }) {
  const showActs = acts.product || acts.guide;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
      <thead><tr>
        <th style={th}>What they typed</th>
        <th style={{ ...th, textAlign: 'right' }}>Searches</th>
        <th style={{ ...th, textAlign: 'right' }}>People</th>
        <th style={{ ...th, textAlign: 'right' }}>Products shown</th>
        {showActs && <th style={{ ...th, textAlign: 'right' }}>Act</th>}
      </tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={td}>{r.query}</td>
            <td style={num}>{r.searches}</td>
            <td style={num}>{r.people}</td>
            <td style={{ ...num, textAlign: 'right' }}>{resultBadge(r.results)}</td>
            {showActs && <td style={num}><RowActions term={r.query} acts={acts} /></td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function SearchDemandPage() {
  const session = await getStaffSession();
  if (!session || !canAny(session, ['analytics', 'products.view', 'blog'])) {
    return <NoAccess section="Search demand" />;
  }

  const { winnable, lowCtr, onsite, gscUpdatedAt, posthog } = await getSearchDemand();

  // Which one-click actions this viewer may take on a demand row.
  const acts = { product: can(session, 'products.edit'), guide: can(session, 'blog') };

  // On-site: gaps first (zero, then thin), each by search volume; then the rest.
  const gaps = onsite.filter(r => r.results === 0).sort((a, b) => b.searches - a.searches);
  const thin = onsite.filter(r => r.results > 0 && r.results <= 2).sort((a, b) => b.searches - a.searches);
  const healthy = onsite.filter(r => r.results > 2 || r.results < 0).sort((a, b) => b.searches - a.searches);

  return (
    <div className="adm-page" style={{ padding: '32px 36px', maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Search demand</h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#6b7280', maxWidth: 680 }}>
          What people are searching for, and where you&apos;re not meeting it. Use this to decide what to stock next and
          which pages to strengthen. Two sources: your own on-site search box, and Google (Search Console).
          {(acts.product || acts.guide) && ' Any row can start a matching product or guide in one click, pre-filled with the searched term.'}
        </p>
      </div>

      {/* ── On-site gaps: the stock/create shopping list ── */}
      <Card
        title="On-site searches with no results"
        subtitle="People searched your site for these and saw nothing. Each is a product to stock or a page to create."
      >
        {gaps.length > 0 ? <OnsiteTable rows={gaps} acts={acts} />
          : posthog === 'no-key' ? <Empty>On-site search analytics aren&apos;t connected.</Empty>
          : <Empty>No zero-result searches in the last 60 days. Nice.</Empty>}
      </Card>

      {thin.length > 0 && (
        <Card
          title="On-site searches with thin results"
          subtitle="Only one or two products matched. Worth adding depth to the range or checking the product naming."
        >
          <OnsiteTable rows={thin} acts={acts} />
        </Card>
      )}

      {/* ── Google: winnable rankings ── */}
      <Card
        title="Google: winnable queries (page 2–4)"
        subtitle={`You already rank for these but off page 1. A content or internal-link push can move them up.${gscUpdatedAt ? ` GSC data as of ${fmtDatePK(gscUpdatedAt)}.` : ''}`}
      >
        {winnable.length > 0 ? <GscTable rows={winnable} acts={acts} /> : <Empty>No Search Console data cached yet.</Empty>}
      </Card>

      {/* ── Google: page-1 low CTR ── */}
      {lowCtr.length > 0 && (
        <Card
          title="Google: ranking well but few clicks"
          subtitle="On page 1 with a low click-through rate — usually a title / description that isn't selling the click."
        >
          <GscTable rows={lowCtr} acts={acts} />
        </Card>
      )}

      {/* ── On-site: everything else, for reference ── */}
      {healthy.length > 0 && (
        <Card
          title="On-site: top searches"
          subtitle="Your most-searched terms overall (results look healthy)."
        >
          <OnsiteTable rows={healthy.slice(0, 20)} acts={{ product: false, guide: false }} />
        </Card>
      )}

      <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 8 }}>
        Google data refreshes daily. On-site search covers the last 60 days. See ranking detail in{' '}
        <Link href="/admin/analytics" style={{ color: '#6b7280', textDecoration: 'underline' }}>Analytics</Link>.
      </p>
    </div>
  );
}
