export const dynamic = 'force-dynamic';

// "Today's homepage": runs the SAME merchandising composer as the storefront
// homepage (lib/merchandising) against live data and shows every rail's four
// tiles with the one-sentence reason each product earned its slot. Because
// the composer is deterministic given (data, PKT day), what renders here is
// what the homepage serves — except the live page can lag by up to its
// 1-hour ISR window and scores refresh once daily in the morning cron.

import Link from 'next/link';
import {
  getFeatured, getTopSellers, getTrending, getOnSale,
  getNewArrivals, getProductsByBrands, getWellnessProducts, getSiteSettings,
} from '@/lib/supabase';
import { K_BEAUTY_BRANDS } from '@/lib/k-beauty';
import { composeHomepageRails, type RailTile } from '@/lib/merchandising';
import { getStaffSession } from '@/lib/staff-auth';
import { can } from '@/lib/permissions';
import { NoAccess } from '@/components/admin/NoAccess';
import { ProductImage } from '@/components/ui/ProductImage';

function Rail({ title, tiles, note }: { title: string; tiles: RailTile[]; note?: string }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ margin: '0 0 2px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{title}</h2>
      {note && <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: '#6b7280' }}>{note}</p>}
      {tiles.length === 0 ? (
        <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: '#9ca3af' }}>Empty today — this rail self-hides on the storefront.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 10 }}>
          {tiles.map(({ product: p, reason }) => (
            <div key={p.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', gap: 10, padding: 10 }}>
                <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#faf6ee' }}>
                  <ProductImage src={p.image_url} alt={p.name} width={52} height={52} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <Link href={`/product/${p.slug}`} style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </Link>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>PKR {p.price.toLocaleString()}</span>
                </div>
              </div>
              <div style={{ padding: '8px 10px', borderTop: '1px solid #f3f4f6', fontSize: '0.71875rem', color: '#6b7280', lineHeight: 1.45 }}>
                {reason}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function HomepagePreviewPage() {
  const session = await getStaffSession();
  if (!session || !can(session, 'analytics')) return <NoAccess section="Homepage preview" />;

  const [featured, topSellers, trending, saleProducts, wellnessProducts, kBeautyProducts, newArrivals, settings] = await Promise.all([
    getFeatured(), getTopSellers(8), getTrending(12), getOnSale(8),
    getWellnessProducts(), getProductsByBrands(K_BEAUTY_BRANDS, 24), getNewArrivals(24), getSiteSettings(),
  ]);
  const saleActive = (settings.sale_active ?? '').toLowerCase() === 'true' || settings.sale_active === '1';
  const rails = composeHomepageRails({
    featuredPool: featured, sellersPool: topSellers, trendingPool: trending,
    salePool: saleProducts, newInPool: newArrivals, kBeautyPool: kBeautyProducts,
    wellnessPool: wellnessProducts, saleActive,
  });

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.375rem', fontWeight: 700, color: '#111827' }}>Today&apos;s homepage</h1>
      <p style={{ margin: '0 0 24px', fontSize: '0.8125rem', color: '#6b7280', maxWidth: 720 }}>
        The exact product rails the homepage serves today, with the reason each product earned its slot.
        Rotation reshuffles once per day (Pakistan time). The live page can lag this view by up to an hour
        (its cache window), and shopper-activity scores refresh each morning.
      </p>
      <Rail title="Featured" tiles={rails.featured} note='"The owner flagged it, it&apos;s in stock, and flagged products take turns daily."' />
      <Rail title="Best Sellers" tiles={rails.bestSellers} note='"Most units sold recently, plus up to two owner picks."' />
      <Rail title="Trending Now" tiles={rails.trending} note='"Highest shopper activity this week that isn&apos;t already a best seller."' />
      {saleActive && <Rail title="On Sale Now" tiles={rails.sale} note='"The deepest live discounts, in stock, at least 10% off."' />}
      <Rail title="New In" tiles={rails.newIn} note='"Added in the last 30 days, newest first, not shown above."' />
      <Rail title="K-Beauty" tiles={rails.kBeauty} note='"In-stock picks from the curated Korean brands, max two per brand, rotating daily."' />
      <Rail title="Wellness rail" tiles={rails.wellnessRail} note='"The wellness products shoppers engage with most, rotating daily."' />
    </div>
  );
}
