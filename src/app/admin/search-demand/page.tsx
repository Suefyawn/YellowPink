export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getStaffSession } from '@/lib/staff-auth';
import { can, canAny } from '@/lib/permissions';
import { NoAccess } from '@/components/admin/NoAccess';
import { EmptyState } from '@/components/admin/EmptyState';
import { supabaseAdmin } from '@/lib/supabase';
import { getSearchDemand, RANGE_OPTIONS } from './actions';
import { SynonymManager, type Synonym } from '@/components/admin/SynonymManager';
import { SearchDemandDashboard } from '@/components/admin/SearchDemandDashboard';
import { fmtDatePK } from '@/lib/dates';

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
  const demand = await getSearchDemand(rangeDays);
  const { posthog, days, gscUpdatedAt } = demand;

  // Which one-click actions this viewer may take on a demand row.
  const acts = { product: can(session, 'products.edit'), guide: can(session, 'blog') };

  // The synonym map is part of the catalogue's search behaviour → products.edit.
  let synonyms: Synonym[] = [];
  if (acts.product) {
    const { data } = await supabaseAdmin()
      .from('search_synonyms').select('term, canonical, note').order('created_at', { ascending: false });
    synonyms = (data ?? []) as Synonym[];
  }

  const synonymsSlot = acts.product ? (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid #f3f4f6' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Search synonyms</h2>
        <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
          When a searched word finds nothing only because of wording (&ldquo;vit c&rdquo; vs &ldquo;vitamin c&rdquo;,
          &ldquo;sunblock&rdquo; vs &ldquo;sunscreen&rdquo;), map it here. The storefront search then quietly searches
          your wording instead.
        </p>
      </div>
      <div id="synonyms" style={{ scrollMarginTop: 80, overflowX: 'auto' }}>
        <SynonymManager synonyms={synonyms} prefillTerm={prefillTerm?.slice(0, 120)} />
      </div>
    </section>
  ) : null;

  return (
    <div className="adm-page" style={{ padding: '32px 36px', maxWidth: 980 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Search demand</h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#6b7280', maxWidth: 720 }}>
          What people are searching for, and where you&apos;re not meeting it. Use this to decide what to stock next and
          which pages to strengthen. Two sources: your own on-site search box, and Google (Search Console).
          {(acts.product || acts.guide) && ' Any row can start a matching product or guide in one click, pre-filled with the searched term.'}
        </p>
      </div>

      {/* ── on-site window range (server param, keeps URLs shareable) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
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
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>on-site window (comparisons use the {days} days before it)</span>
      </div>

      {posthog === 'no-key' && (
        <div style={{ marginBottom: 24 }}>
          <EmptyState compact icon="plug" title="On-site search analytics aren't connected" ctaHref="/admin/settings/integrations" ctaLabel="Open Integrations">
            Connect PostHog to see what shoppers search for on the site, what they find, and what they buy after searching.
          </EmptyState>
        </div>
      )}

      <SearchDemandDashboard
        onsite={demand.onsite}
        nonConverting={demand.nonConverting}
        winnable={demand.winnable}
        lowCtr={demand.lowCtr}
        brandDemand={demand.brandDemand}
        categoryDemand={demand.categoryDemand}
        daily={demand.daily}
        hasResultCounts={demand.hasResultCounts}
        kpis={demand.kpis}
        moversUp={demand.moversUp}
        moversDown={demand.moversDown}
        moverHistoryDays={demand.moverHistoryDays}
        ignored={demand.ignored}
        acts={acts}
        days={days}
        gscUpdatedAt={gscUpdatedAt}
        posthogConnected={posthog === 'ok'}
        synonymsSlot={synonymsSlot}
      />

      <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 8 }}>
        Google data refreshes daily (Search Console&apos;s own rolling window, unaffected by the toggle).
        {gscUpdatedAt ? ` GSC data as of ${fmtDatePK(gscUpdatedAt)}.` : ''} On-site search, the trend chart and the
        sparklines cover the last {days} days. See ranking detail in{' '}
        <Link href="/admin/analytics" style={{ color: '#6b7280', textDecoration: 'underline' }}>Analytics</Link>.
      </p>
    </div>
  );
}
