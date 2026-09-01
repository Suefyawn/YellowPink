export const dynamic = 'force-dynamic';

// "Today's homepage": runs the SAME merchandising composer as the storefront
// homepage (lib/merchandising) against live data and shows every rail's
// tiles with the one-sentence reason each product earned its slot. Since
// 1 Sep 2026 it is also the rails MANAGER: staff with product-edit rights
// can feature/un-feature, pin/unpin and search products in from here — the
// composer's logic (rotation, dedupe, demand ordering) stays in charge, the
// buttons only flip the two owner inputs it reads.

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
import { RailProductSearch } from '@/components/admin/RailProductSearch';
import { setRailFlag, setFeaturedFillup } from './actions';

function FlagButton({ id, flag, on, label }: { id: string; flag: 'featured' | 'bestseller'; on: boolean; label: string }) {
  return (
    <form action={setRailFlag} style={{ display: 'inline' }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="flag" value={flag} />
      <input type="hidden" name="on" value={on ? '0' : '1'} />
      <button type="submit" style={{
        fontSize: '0.6875rem', fontWeight: 600, padding: '3px 8px', borderRadius: 99, cursor: 'pointer',
        border: on ? '1px solid #C5286A' : '1px solid #d1d5db',
        background: on ? '#C5286A' : 'white', color: on ? 'white' : '#374151',
      }}>
        {label}
      </button>
    </form>
  );
}

function Rail({ title, tiles, note, canEdit }: { title: string; tiles: RailTile[]; note?: string; canEdit: boolean }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ margin: '0 0 2px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{title}</h2>
      {note && <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: '#6b7280' }}>{note}</p>}
      {tiles.length === 0 ? (
        <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: '#9ca3af' }}>Empty today — this rail self-hides on the storefront.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginTop: 10 }}>
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
              {canEdit && (
                <div style={{ padding: '8px 10px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <FlagButton id={p.id} flag="featured" on={Boolean(p.is_featured)}
                    label={p.is_featured ? 'Featured ✓ (remove)' : 'Feature'} />
                  <FlagButton id={p.id} flag="bestseller" on={Boolean(p.is_bestseller)}
                    label={p.is_bestseller ? 'Pinned ✓ (unpin)' : 'Pin seller'} />
                </div>
              )}
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
  const canEdit = can(session, 'products.edit');

  const [featured, topSellers, trending, saleProducts, wellnessProducts, kBeautyProducts, newArrivals, settings] = await Promise.all([
    getFeatured(), getTopSellers(8), getTrending(12), getOnSale(8),
    getWellnessProducts(), getProductsByBrands(K_BEAUTY_BRANDS, 24), getNewArrivals(24), getSiteSettings(),
  ]);
  const saleActive = (settings.sale_active ?? '').toLowerCase() === 'true' || settings.sale_active === '1';
  const featuredFillup = settings.featured_fillup !== 'false';
  const rails = composeHomepageRails({
    featuredPool: featured, sellersPool: topSellers, trendingPool: trending,
    salePool: saleProducts, newInPool: newArrivals, kBeautyPool: kBeautyProducts,
    wellnessPool: wellnessProducts, saleActive, featuredFillup,
  });

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.375rem', fontWeight: 700, color: '#111827' }}>Today&apos;s homepage</h1>
      <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280', maxWidth: 720 }}>
        The exact product rails the homepage serves today, with the reason each product earned its slot.
        {canEdit && ' Use the buttons on any tile (or the search box) to feature a product in the This Week row, or pin it as a Best Seller; the rails re-compose immediately.'}
        {' '}Rotation reshuffles once per day (Pakistan time); the live page can lag this view by up to an hour.
      </p>

      {canEdit && <RailProductSearch />}

      {canEdit && (
        <form action={setFeaturedFillup} style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8125rem', color: '#374151' }}>
          <input type="hidden" name="on" value={featuredFillup ? '0' : '1'} />
          <span>
            Featured fill-up is <strong>{featuredFillup ? 'on' : 'off'}</strong>
            {featuredFillup
              ? ' — when fewer than 4 products are flagged, trending products top the row up.'
              : ' — the This Week row shows only products you flagged (it may run short).'}
          </span>
          <button type="submit" style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: 7, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>
            Turn {featuredFillup ? 'off' : 'on'}
          </button>
        </form>
      )}

      <Rail canEdit={canEdit} title="Featured (the This Week row)" tiles={rails.featured} note='"The owner flagged it, it&apos;s in stock, and flagged products take turns daily."' />
      <Rail canEdit={canEdit} title="Best Sellers" tiles={rails.bestSellers} note='"Most units sold recently, plus up to two owner picks."' />
      <Rail canEdit={canEdit} title="Trending Now" tiles={rails.trending} note='"Highest shopper activity this week that isn&apos;t already a best seller."' />
      {saleActive && <Rail canEdit={canEdit} title="On Sale Now" tiles={rails.sale} note='"The deepest live discounts, in stock, at least 10% off."' />}
      <Rail canEdit={canEdit} title="New In" tiles={rails.newIn} note='"Added in the last 30 days, newest first, not shown above."' />
      <Rail canEdit={canEdit} title="K-Beauty" tiles={rails.kBeauty} note='"In-stock picks from the curated Korean brands, max two per brand, rotating daily."' />
      <Rail canEdit={canEdit} title="Wellness rail" tiles={rails.wellnessRail} note='"The wellness products shoppers engage with most, rotating daily."' />
    </div>
  );
}
