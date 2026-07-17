// TEMPORARY dev-only visual harness for SearchDemandDashboard (synthetic
// data). Deleted before merge — never ships.
import { notFound } from 'next/navigation';
import { SearchDemandDashboard } from '@/components/admin/SearchDemandDashboard';
import type { OnsiteRow, DemandDay } from '@/app/admin/search-demand/actions';

export const dynamic = 'force-dynamic';

function synthDaily(days: number): DemandDay[] {
  const out: DemandDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    const base = 14 + Math.round(10 * Math.sin(i / 4)) + (i % 7 === 0 ? 9 : 0);
    out.push({ date: d, searches: base, people: Math.round(base * 0.7), zero: Math.round(base * 0.22) });
  }
  return out;
}

const t = (query: string, searches: number, prev: number, results: number, people?: number): OnsiteRow =>
  ({ query, searches, prev, results, people: people ?? Math.round(searches * 0.8), spark: [Math.round(prev / 4), Math.round(searches / 5), Math.round(searches / 3), Math.round(searches / 2)] });

export default function Preview() {
  if (process.env.NODE_ENV === 'production') notFound();
  const onsite: OnsiteRow[] = [
    t('snail mucin', 42, 18, 0),
    t('setting spray', 31, 24, 0),
    t('cosrx', 28, 30, 2),
    t('cerave cleanser', 26, 9, 6),
    t('sunscreen', 24, 26, 9),
    t('huda beauty', 19, 0, 5),
    t('niacinamide', 17, 22, 4),
    t('hair serum', 12, 19, 1),
    t('lip oil', 9, 16, 0),
    t('collagen', 8, 3, 7),
  ];
  return (
    <div className="adm-page" style={{ padding: '32px 36px', maxWidth: 980 }}>
      <SearchDemandDashboard
        onsite={onsite}
        nonConverting={[
          { query: 'sunscreen', searchers: 21, buyers: 1, results: 9 },
          { query: 'niacinamide', searchers: 14, buyers: 3, results: 4 },
        ]}
        winnable={[
          { query: 'best sunscreen in pakistan', impressions: 412, clicks: 6, position: 12.4, ctr: 0.014 },
          { query: 'cosrx pakistan', impressions: 233, clicks: 3, position: 15.1, ctr: 0.013 },
          { query: 'snail mucin price', impressions: 187, clicks: 2, position: 22.8, ctr: 0.01 },
        ]}
        lowCtr={[{ query: 'yellow pink pk', impressions: 300, clicks: 9, position: 2.1, ctr: 0.03 }]}
        brandDemand={[{ name: 'COSRX', searches: 46, terms: 4 }, { name: 'CeraVe', searches: 31, terms: 3 }, { name: 'Huda Beauty', searches: 19, terms: 2 }]}
        categoryDemand={[{ name: 'Sunscreens', searches: 24, terms: 2 }, { name: 'Cleansers & Treatments', searches: 21, terms: 3 }]}
        daily={synthDaily(30)}
        hasResultCounts
        kpis={{ searches: 486, prevSearches: 371, people: 302, prevPeople: 264, uniqueTerms: 63, zeroShare: 0.24, buyThrough: 0.11, prevBuyThrough: 0.09 }}
        moversUp={[{ query: 'best sunscreen in pakistan', impressions: 412, position: 12.4, prevPosition: 16.9, prevImpressions: 300 }]}
        moversDown={[{ query: 'kojic acid soap', impressions: 88, position: 9.4, prevPosition: 6.2, prevImpressions: 120 }]}
        moverHistoryDays={8}
        ignored={['asdfgh', 'test order']}
        acts={{ product: true, guide: true }}
        days={30}
        gscUpdatedAt={null}
        posthogConnected
        synonymsSlot={null}
      />
    </div>
  );
}
