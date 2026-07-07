// 5-min ISR, featured products / new arrivals / hero copy change at most
// every few hours, and the global cache header in next.config.ts already
// puts a CDN in front. Was `force-dynamic` before the 2026-05-24 audit.
export const revalidate = 300;

import {
  getTopSellers,
  getTrending,
  getFeatured,
  getOnSale,
  getProductsByBrands,
  getWellnessProducts,
  getSiteSettings,
  getBlogPosts,
} from '@/lib/supabase';
import { jsonLd, itemListLd, productInStock } from '@/lib/seo';
import { K_BEAUTY_BRANDS } from '@/lib/k-beauty';
import { getPublishedCollectionsWithCovers } from '@/lib/collections-data';
import { buildWellnessShowcase } from '@/lib/wellness-data';
import { categoryHref } from '@/lib/category-taxonomy';

// Homepage "Shop by category" tiles, four makeup/skincare + four wellness,
// equal billing for the "beauty, inside out" concept.
const MAKEUP_TILE_CATS = ['Lip & Cheek Tints', 'Highlighters', 'Face Makeup', 'Cleansers & Treatments'];
const WELLNESS_TILE_CATS = ["Women's Health", "Men's Health", 'Immunity', 'Bone & Joint'];

// Curated editorial image per tile category, served from /public/categories.
// Vibrant, modern, in-context lifestyle/macro shots (glossy lips, golden
// highlighter, fresh fruit, active people) that read clearly at a glance on a
// phone — a refresh of the older cream-backdrop product stills. Kept in the
// repo (not Supabase Storage) so they deploy and version with the code.
const CATEGORY_IMAGE_BASE = '/categories';
const CATEGORY_TILE_FILES: Record<string, string> = {
  'Lip & Cheek Tints': 'lip-cheek-tints.webp',
  Highlighters: 'highlighters.webp',
  'Face Makeup': 'face-makeup.webp',
  'Cleansers & Treatments': 'cleansers-treatments.webp',
  "Women's Health": 'womens-health.webp',
  "Men's Health": 'mens-health.webp',
  Immunity: 'immunity.webp',
  'Bone & Joint': 'bone-joint.webp',
};
import { HeroSection } from '@/sections/home/HeroSection';
import { TrustBar } from '@/sections/home/TrustBar';
import { FeaturedProducts } from '@/sections/home/FeaturedProducts';
import { EditorialDuo } from '@/sections/home/EditorialDuo';
import { SaleCollection } from '@/sections/home/SaleCollection';
import { ProductRail } from '@/sections/home/ProductRail';
import { WellnessSection } from '@/sections/home/WellnessSection';
import { KBeautySection } from '@/sections/home/KBeautySection';
import { CategoryTiles } from '@/sections/home/CategoryTiles';
import { CollectionsSection } from '@/sections/home/CollectionsSection';
import { RealResults } from '@/sections/home/RealResults';
import { JournalSection } from '@/sections/home/JournalSection';
import { PressStrip } from '@/sections/home/PressStrip';
import { QuizBand } from '@/sections/home/QuizBand';

export default async function HomePage() {
  // Pull each rail in parallel. The new helpers all fall back to a stock-
  // /recency-ordered slice of the live catalog if their flag-based query
  // returns fewer rows than requested, so empty sections shouldn't happen
  // once the catalog has any products. Migration 076 backfilled
  // is_featured + is_bestseller; the queries respect those first.
  const [featured, topSellers, trending, saleProducts, wellnessProducts, kBeautyProducts, settings, blogPosts, collections] = await Promise.all([
    getFeatured(6),
    getTopSellers(4),
    getTrending(8),
    getOnSale(8),
    getWellnessProducts(),
    getProductsByBrands(K_BEAUTY_BRANDS, 4),
    getSiteSettings(),
    getBlogPosts(),
    getPublishedCollectionsWithCovers(3),
  ]);

  // Keep the two rails distinct: a product that's a top seller shouldn't also
  // fill the Trending rail (most visible when both fall back to recency before
  // the nightly trend refresh has run).
  const topSellerIds = new Set(topSellers.map(p => p.id));
  const trendingRail = trending.filter(p => !topSellerIds.has(p.id)).slice(0, 4);

  // Shape the full wellness set into per-concern cards + a featured rail.
  const wellness = buildWellnessShowcase(wellnessProducts);

  // The featured sale collection is shown only while a sale is switched on
  // in Admin → Settings → Sale (the central on/off switch).
  const saleActive = settings.sale_active === 'true';

  const tile = (label: string) => ({
    label,
    href: categoryHref(label),
    image: CATEGORY_IMAGE_BASE ? `${CATEGORY_IMAGE_BASE}/${CATEGORY_TILE_FILES[label]}` : undefined,
  });
  const categoryGroups = [
    { title: 'Makeup & Skincare', tiles: MAKEUP_TILE_CATS.map(tile) },
    { title: 'Health & Wellness', tiles: WELLNESS_TILE_CATS.map(tile) },
  ];

  // Seasonal hero override, while the seasonal makeover is on, the homepage
  // hero uses the season_hero_* settings; any field left blank falls back to
  // the normal hero value. The secondary CTA + brand-logo row aren't seasonal.
  const seasonOn = settings.season_active === 'true';
  const heroField = (seasonKey: string, normalKey: string): string =>
    (seasonOn && settings[seasonKey]) || settings[normalKey] || '';
  const heroSettings = {
    overline: heroField('season_hero_overline', 'hero_overline'),
    headline: heroField('season_hero_headline', 'hero_headline'),
    subline: heroField('season_hero_subline', 'hero_subline'),
    cta1Text: heroField('season_hero_cta1_text', 'hero_cta1_text'),
    cta1Url: heroField('season_hero_cta1_url', 'hero_cta1_url'),
    cta2Text: settings.hero_cta2_text,
    cta2Url: settings.hero_cta2_url,
    imageUrl: heroField('season_hero_image_url', 'hero_image_url'),
    brands: settings.hero_brands ? settings.hero_brands.split(',').map(b => b.trim()) : [],
  };

  return (
    <main className="fade-in">
      {/* Best-sellers ItemList so the homepage's product links are eligible for
          a product carousel / richer sitelinks (Organization + WebSite schema
          are emitted site-wide from the root layout). */}
      {topSellers.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(itemListLd('Best sellers', topSellers.map(p => ({
              name: p.name, path: `/product/${p.slug}`, image: p.image_url, brand: p.brand, price: p.price, inStock: productInStock(p),
            })))),
          }}
        />
      )}
      <HeroSection settings={heroSettings} />
      <TrustBar />
      <FeaturedProducts products={featured.length ? featured.slice(0, 4) : topSellers.slice(0, 4)} />
      <QuizBand />
      <KBeautySection products={kBeautyProducts} />
      <EditorialDuo />
      {saleActive && (
        <SaleCollection
          products={saleProducts}
          title={settings.sale_title || 'On Sale Now'}
          subtitle={settings.sale_subtitle}
          ctaText={settings.sale_cta_text || 'Shop the Sale'}
          ctaUrl={settings.sale_cta_url || '/shop?sale=1'}
        />
      )}
      {/* Two data-driven rails, refreshed nightly by the popularity cron:
          Best Sellers = what's actually bought (units_sold, owner pin leads);
          Trending Now = recent momentum (views + add-to-carts). */}
      <ProductRail
        overline="Best Sellers"
        heading="What everyone's buying."
        blurb="Ranked by what our customers actually order, refreshed daily."
        ctaHref="/shop"
        ctaLabel="Shop all"
        products={topSellers}
        tinted
      />
      <ProductRail
        overline="Trending Now"
        heading="Picking up steam."
        blurb="The products getting the most attention this week."
        ctaHref="/shop"
        ctaLabel="See what's hot"
        products={trendingRail}
      />
      <WellnessSection concerns={wellness.concerns} rail={wellness.rail} totalCount={wellness.totalCount} />
      <CategoryTiles groups={categoryGroups} />
      <CollectionsSection collections={collections} />
      <RealResults />
      <JournalSection posts={blogPosts} />
      <PressStrip />
    </main>
  );
}
