export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getStaffSession } from '@/lib/staff-auth';
import { can, canAny } from '@/lib/permissions';
import { NoAccess } from '@/components/admin/NoAccess';
import { EmptyState } from '@/components/admin/EmptyState';
import { supabaseAdmin } from '@/lib/supabase';
import { getSearchDemand, RANGE_OPTIONS, type GscRow, type OnsiteRow, type ConvRow, type RollupRow } from './actions';
import { SynonymManager, type Synonym } from '@/components/admin/SynonymManager';
import { SearchDemandExport } from '@/components/admin/SearchDemandExport';
import { Sparkline } from '@/components/admin/insights/Sparkline';
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
const actSynonym: React.CSSProperties = { ...actBtn, background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' };

// One-click "act on this demand": seed a new product / guide with the term, or
// (for a term that found nothing) map it to a synonym that does. The forms
// read ?name= / ?title= and pre-fill; "+ Synonym" jumps to the synonym card
// with the term pre-loaded, so the owner lands on a half-started task not a
// blank page.
function RowActions({ term, acts, guideOnly = false, synonym = false }: { term: string; acts: Acts; guideOnly?: boolean; synonym?: boolean }) {
  const t = encodeURIComponent(term.slice(0, 120));
  return (
    <span style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      {!guideOnly && acts.product && <Link href={`/admin/products/new?name=${t}`} style={actProduct}>+ Product</Link>}
      {acts.guide && <Link href={`/admin/blog/new?title=${t}`} style={actGuide}>+ Guide</Link>}
      {synonym && acts.product && <Link href={`/admin/search-demand?map=${t}#synonyms`} style={actSynonym}>+ Synonym</Link>}
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
  return <EmptyState compact icon="search" title="Nothing here yet">{children}</EmptyState>;
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

function OnsiteTable({ rows, acts, withSynonym = false }: { rows: OnsiteRow[]; acts: Acts; withSynonym?: boolean }) {
  const showActs = acts.product || acts.guide;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
      <thead><tr>
        <th style={th}>What they typed</th>
        <th style={{ ...th, textAlign: 'right' }}>Searches</th>
        <th style={{ ...th, textAlign: 'right' }}>People</th>
        <th style={th}>Trend</th>
        <th style={{ ...th, textAlign: 'right' }}>Products shown</th>
        {showActs && <th style={{ ...th, textAlign: 'right' }}>Act</th>}
      </tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={td}>{r.query}</td>
            <td style={num}>{r.searches}</td>
            <td style={num}>{r.people}</td>
            <td style={{ ...td, width: 72 }}>
              {r.spark.some(v => v > 0) ? <Sparkline values={r.spark} color="#C5286A" /> : <span style={{ color: '#d1d5db' }}>—</span>}
            </td>
            <td style={{ ...num, textAlign: 'right' }}>{resultBadge(r.results)}</td>
            {showActs && <td style={num}><RowActions term={r.query} acts={acts} synonym={withSynonym} /></td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function pctRate(n: number) { return `${Math.round(n * 100)}%`; }

// C1 — searched, products shown, but the searchers rarely buy.
function ConvTable({ rows }: { rows: ConvRow[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
      <thead><tr>
        <th style={th}>What they typed</th>
        <th style={{ ...th, textAlign: 'right' }}>Searchers</th>
        <th style={{ ...th, textAlign: 'right' }}>Went on to buy</th>
        <th style={{ ...th, textAlign: 'right' }}>Buy-through</th>
        <th style={{ ...th, textAlign: 'right' }}>Products shown</th>
      </tr></thead>
      <tbody>
        {rows.map((r, i) => {
          const rate = r.searchers ? r.buyers / r.searchers : 0;
          return (
            <tr key={i}>
              <td style={td}>{r.query}</td>
              <td style={num}>{r.searchers}</td>
              <td style={num}>{r.buyers}</td>
              <td style={{ ...num, color: rate < 0.1 ? '#b91c1c' : rate < 0.25 ? '#b45309' : '#059669', fontWeight: 700 }}>{pctRate(rate)}</td>
              <td style={num}>{r.results}+</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// C2 — search interest rolled up to a stocked brand / category.
function RollupTable({ rows, label }: { rows: RollupRow[]; label: string }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 360 }}>
      <thead><tr>
        <th style={th}>{label}</th>
        <th style={{ ...th, textAlign: 'right' }}>Searches</th>
        <th style={{ ...th, textAlign: 'right' }}>Terms</th>
      </tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={td}>{r.name}</td>
            <td style={num}>{r.searches}</td>
            <td style={num}>{r.terms}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function SearchDemandPage({
  searchParams,
}: {
  searchParams: Promise<{ map?: string; range?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || !canAny(session, ['analytics', 'products.view', 'blog'])) {
    return <NoAccess section="Search demand" />;
  }

  const { map: prefillTerm, range } = await searchParams;
  const rangeDays = parseInt(range ?? '', 10) || undefined;
  const { winnable, lowCtr, onsite, nonConverting, brandDemand, categoryDemand, gscUpdatedAt, posthog, days } = await getSearchDemand(rangeDays);

  // Which one-click actions this viewer may take on a demand row.
  const acts = { product: can(session, 'products.edit'), guide: can(session, 'blog') };

  // The synonym map is part of the catalogue's search behaviour → products.edit.
  let synonyms: Synonym[] = [];
  if (acts.product) {
    const { data } = await supabaseAdmin()
      .from('search_synonyms').select('term, canonical, note').order('created_at', { ascending: false });
    synonyms = (data ?? []) as Synonym[];
  }

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

      {/* ── Controls: on-site window range + CSV export ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ display: 'inline-flex', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          {RANGE_OPTIONS.map(n => {
            const active = n === days;
            return (
              <Link
                key={n}
                href={`/admin/search-demand?range=${n}`}
                style={{
                  padding: '6px 12px', fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none',
                  background: active ? '#C5286A' : '#fff', color: active ? '#fff' : '#6b7280',
                  borderLeft: n === RANGE_OPTIONS[0] ? 'none' : '1px solid #e5e7eb',
                }}
              >
                {n}d
              </Link>
            );
          })}
        </div>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>on-site window</span>
        <span style={{ marginLeft: 'auto' }}><SearchDemandExport rows={onsite} days={days} /></span>
      </div>

      {/* ── On-site gaps: the stock/create shopping list ── */}
      <Card
        title="On-site searches with no results"
        subtitle="People searched your site for these and saw nothing. Each is a product to stock, a page to create, or a naming mismatch to map with a synonym."
      >
        {gaps.length > 0 ? <OnsiteTable rows={gaps} acts={acts} withSynonym />
          : posthog === 'no-key' ? (
            <EmptyState compact icon="plug" title="On-site search analytics aren't connected" ctaHref="/admin/settings/integrations" ctaLabel="Open Integrations">
              Connect PostHog to see what shoppers search for on the site and find nothing.
            </EmptyState>
          )
          : <Empty>No zero-result searches in the last 60 days. Nice.</Empty>}
      </Card>

      {/* ── Synonym map: fix naming mismatches without changing the catalogue ── */}
      {acts.product && (
        <Card
          title="Search synonyms"
          subtitle="When a searched word finds nothing only because of wording (&ldquo;vit c&rdquo; vs &ldquo;vitamin c&rdquo;, &ldquo;sunblock&rdquo; vs &ldquo;sunscreen&rdquo;), map it here. The storefront search then quietly searches your wording instead."
        >
          <div id="synonyms" style={{ scrollMarginTop: 80 }}>
            <SynonymManager synonyms={synonyms} prefillTerm={prefillTerm?.slice(0, 120)} />
          </div>
        </Card>
      )}

      {thin.length > 0 && (
        <Card
          title="On-site searches with thin results"
          subtitle="Only one or two products matched. Worth adding depth to the range or checking the product naming."
        >
          <OnsiteTable rows={thin} acts={acts} withSynonym />
        </Card>
      )}

      {/* ── C1: demand you're losing at the shelf ── */}
      {nonConverting.length > 0 && (
        <Card
          title="Searched, shown products, but rarely bought"
          subtitle="These searches DO return products, but few of the people searching them go on to buy anything. Often a price, imagery, stock or trust problem on the products they land on. Buy-through = share of searchers who purchased within the window (a cohort estimate, not per-item attribution)."
        >
          <ConvTable rows={nonConverting} />
        </Card>
      )}

      {/* ── C2: brand & category demand rollups ── */}
      {(brandDemand.length > 0 || categoryDemand.length > 0) && (
        <Card
          title="Demand by brand & category"
          subtitle="On-site searches rolled up to the brands and categories you stock, so you can see which ranges shoppers hunt for by name — worth featuring, restocking or expanding."
        >
          <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            <div style={{ overflowX: 'auto', borderRight: '1px solid #f3f4f6' }}>
              {brandDemand.length > 0 ? <RollupTable rows={brandDemand} label="Brand" /> : <Empty>No brand-name searches yet.</Empty>}
            </div>
            <div style={{ overflowX: 'auto' }}>
              {categoryDemand.length > 0 ? <RollupTable rows={categoryDemand} label="Category" /> : <Empty>No category searches yet.</Empty>}
            </div>
          </div>
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
        Google data refreshes daily (Search Console&apos;s own rolling window, unaffected by the toggle).
        On-site search and the trend sparklines cover the last {days} days. See ranking detail in{' '}
        <Link href="/admin/analytics" style={{ color: '#6b7280', textDecoration: 'underline' }}>Analytics</Link>.
      </p>
    </div>
  );
}
