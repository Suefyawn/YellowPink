// 5-min ISR, featured products / new arrivals / hero copy change at most
// every few hours, and the global cache header in next.config.ts already
// puts a CDN in front. Was `force-dynamic` before the 2026-05-24 audit.
export const revalidate = 3600; // writes bust explicitly (revalidateStorefrontCatalog); long window = warm cache

import {
  getFeaturedBlogPost,
  getNewArrivals,
  getTopSellers,
  getTrending,
  getFeatured,
  getHomeSocialProof,
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
import { ALL_CATEGORIES, categoryHref } from '@/lib/category-taxonomy';
import Link from 'next/link';
import { resolveBrandLogos, resolveBrandLogosByTrend } from '@/lib/brands';
import { composeHomepageRails, pickBlogHero } from '@/lib/merchandising';

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
import { CategoryChipStrip } from '@/sections/home/CategoryChipStrip';
import { HomeSearchPill } from '@/sections/home/HomeSearchPill';
import { WhatsAppBand } from '@/sections/home/WhatsAppBand';
import { FeaturedProducts } from '@/sections/home/FeaturedProducts';
import { EditorialDuo } from '@/sections/home/EditorialDuo';
import { SaleCollection } from '@/sections/home/SaleCollection';
import { ProductRail } from '@/sections/home/ProductRail';
import { WellnessSection } from '@/sections/home/WellnessSection';
import { KBeautySection } from '@/sections/home/KBeautySection';
import { CategoryTiles } from '@/sections/home/CategoryTiles';
import { BrandStrip } from '@/sections/home/BrandStrip';
import { CollectionsSection } from '@/sections/home/CollectionsSection';
import { RealResults } from '@/sections/home/RealResults';
import { JournalSection } from '@/sections/home/JournalSection';
import { QuizBand } from '@/sections/home/QuizBand';
import { ToolsBand } from '@/sections/home/ToolsBand';
import { activeSeasonalTheme } from '@/lib/seasonal-theme';

// Names must match products.brand / brands.name exactly (resolveBrandLogos
// matches on name). This list decides WHICH brands show (picked by Pakistani
// search volume); display ORDER comes from live shopper momentum via
// resolveBrandLogosByTrend, so the carousel leads with what's trending
// (owner call, 7 Aug 2026). The /brand pages for the top three rank on
// page 2-3 and sitewide links are what push archives like these to page 1.
const POPULAR_BRANDS = [
  'Saeed Ghani', 'Rivaj UK', 'Conatural', 'Christine',
  'CeraVe', 'Beauty of Joseon', 'SHEGLAM', 'Nutrifactor',
];

export default async function HomePage() {
  // Pull each rail in parallel. The new helpers all fall back to a stock-
  // /recency-ordered slice of the live catalog if their flag-based query
  // returns fewer rows than requested, so empty sections shouldn't happen
  // once the catalog has any products. Migration 076 backfilled
  // is_featured + is_bestseller; the queries respect those first.
  const [featured, topSellers, trending, saleProducts, wellnessProducts, kBeautyProducts, settings, blogPosts, featuredPost, collections, socialProof, newArrivals, popularBrands] = await Promise.all([
    getFeatured(),
    getTopSellers(8),
    getTrending(12),
    getOnSale(8),
    getWellnessProducts(),
    getProductsByBrands(K_BEAUTY_BRANDS, 24),
    getSiteSettings(),
    getBlogPosts({ limit: 4 }),
    getFeaturedBlogPost(),
    getPublishedCollectionsWithCovers(3),
    getHomeSocialProof(),
    getNewArrivals(24),
    // Shop-by-brand carousel: the brands Pakistanis search for by name
    // (Semrush: "saeed ghani products" 22k/mo, "rivaj uk" 18k/mo, "conatural"
    // 15k/mo …) plus the store's strongest international lines, most trending
    // first (nightly trend scores).
    resolveBrandLogosByTrend(POPULAR_BRANDS),
  ]);

  // The featured sale collection is shown only while a sale is switched on
  // in Admin → Settings → Sale (the central on/off switch).
  const saleActive = (settings.sale_active ?? '').toLowerCase() === 'true' || settings.sale_active === '1';

  // ── Merchandising engine: every rail's eligibility, ordering, rotation and
  // dedupe live in ONE composer (lib/merchandising), allocated in priority
  // order (Featured → Best Sellers → Trending → Sale → New In → K-Beauty →
  // Wellness) so demand rails never lose their products to recency/discount
  // rails. Admin → Homepage preview runs this same function and shows each
  // tile's one-sentence reason.
  const rails = composeHomepageRails({
    featuredPool: featured,
    sellersPool: topSellers,
    trendingPool: trending,
    salePool: saleProducts,
    newInPool: newArrivals,
    kBeautyPool: kBeautyProducts,
    wellnessPool: wellnessProducts,
    saleActive,
  });
  const displayedFeatured = rails.featured.map(t => t.product);
  const topSellersRail = rails.bestSellers.map(t => t.product);
  const trendingRail = rails.trending.map(t => t.product);
  const newInRail = rails.newIn.map(t => t.product);
  const kBeautyRail = rails.kBeauty.map(t => t.product);
  const saleRail = rails.sale.map(t => t.product);

  // Concern cards derive from the full wellness set; only the rail is deduped.
  const wellness = buildWellnessShowcase(wellnessProducts, rails.wellnessRail.map(t => t.product));

  // Journal row: slot 1 is the SAME hero the blog page shows (featured post
  // within 60 days, else newest) so the two surfaces can never disagree;
  // slots 2-3 are the newest posts excluding it.
  const journalPool = [...(featuredPost ? [featuredPost] : []), ...blogPosts]
    .filter((p, i, a) => a.findIndex(x => x.id === p.id) === i);
  const hero = pickBlogHero(journalPool, new Date().toISOString().slice(0, 10));
  const journalPosts = hero
    ? [hero, ...blogPosts.filter(p => p.id !== hero.id)].slice(0, 3)
    : blogPosts.slice(0, 3);

  const tile = (label: string) => ({
    label,
    href: categoryHref(label),
    image: CATEGORY_IMAGE_BASE ? `${CATEGORY_IMAGE_BASE}/${CATEGORY_TILE_FILES[label]}` : undefined,
  });
  const categoryGroups = [
    { title: 'Makeup & Skincare', tiles: MAKEUP_TILE_CATS.map(tile) },
    { title: 'Health & Wellness', tiles: WELLNESS_TILE_CATS.map(tile) },
  ];

  // Seasonal hero override, while a seasonal theme is active (manual or an
  // open scheduled window — activeSeasonalTheme resolves both), the homepage
  // hero uses the season_hero_* settings; any field left blank falls back to
  // the normal hero value. The secondary CTA + brand-logo row aren't seasonal.
  const seasonOn = activeSeasonalTheme(settings) !== null;
  const heroField = (seasonKey: string, normalKey: string): string =>
    (seasonOn && settings[seasonKey]) || settings[normalKey] || '';
  const heroBrandNames = settings.hero_brands ? settings.hero_brands.split(',').map(b => b.trim()) : [];
  const heroBrands = await resolveBrandLogos(heroBrandNames);
  const heroSettings = {
    overline: heroField('season_hero_overline', 'hero_overline'),
    headline: heroField('season_hero_headline', 'hero_headline'),
    subline: heroField('season_hero_subline', 'hero_subline'),
    cta1Text: heroField('season_hero_cta1_text', 'hero_cta1_text'),
    cta1Url: heroField('season_hero_cta1_url', 'hero_cta1_url'),
    cta2Text: settings.hero_cta2_text,
    cta2Url: settings.hero_cta2_url,
    imageUrl: heroField('season_hero_image_url', 'hero_image_url'),
    brands: heroBrands,
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
      {/* Conversion order (July 24 audit): search + category entry within one
          thumb-flick, then nothing but product rails until every proven
          seller has had its shot. Median mobile scroll reaches ~26% of the
          old page; the sections that sell now live inside that window. */}
      <HomeSearchPill />
      <CategoryChipStrip />
      <FeaturedProducts products={displayedFeatured} />
      {saleActive && (
        <SaleCollection
          products={saleRail}
          title={settings.sale_title || 'On Sale Now'}
          subtitle={settings.sale_subtitle}
          ctaText={settings.sale_cta_text || 'Shop the Sale'}
          ctaUrl={settings.sale_cta_url || '/shop?sale=1'}
        />
      )}
      {/* Data-driven rails, refreshed nightly by the popularity cron:
          Best Sellers = what's actually bought (units_sold, owner pin leads);
          Trending Now = recent momentum, shown only when trend_score is real. */}
      <ProductRail
        overline="Best Sellers"
        heading="What everyone's buying."
        blurb="Ranked by what our customers actually order, refreshed daily."
        ctaHref="/collection/bestsellers"
        ctaLabel="Shop all"
        products={topSellersRail}
      />
      <ProductRail
        overline="Trending Now"
        heading="Picking up steam."
        blurb="The products getting the most attention this week."
        ctaHref="/shop"
        ctaLabel="See what's hot"
        products={trendingRail}
        tinted
      />
      <QuizBand />
      <KBeautySection products={kBeautyRail} />
      {/* New arrivals are unproven by definition (no sales/engagement signal
          yet), so they live below the demand-ranked rails: freshness for
          returning shoppers, not premium viewport (owner call, 5 Aug). */}
      <ProductRail
        overline="New In"
        heading="Just landed."
        blurb="The latest additions to the shelf, straight from this week's stock."
        ctaHref="/shop?sort=newest"
        ctaLabel="See all new arrivals"
        products={newInRail}
      />
      <EditorialDuo />
      <WellnessSection concerns={wellness.concerns} rail={wellness.rail} totalCount={wellness.totalCount} />
      <ToolsBand />
      <CategoryTiles groups={categoryGroups} />
      <BrandStrip brands={popularBrands} />
      {/* Crawlable link to EVERY leaf category. The 8 image tiles above cover
          the popular ones; this row completes the set (audit: only 12 of 21
          category landings had any homepage link, and the homepage carried
          ~1/3 the internal links of competitor homepages — the strongest page
          on a low-authority domain must pass PageRank to every landing). */}
      <section style={{ padding: '0 0 var(--section-gap)' }}>
        <div className="container">
          <h2 className="small-text" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-500)', margin: '0 0 14px' }}>
            Shop by category
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ALL_CATEGORIES.map(c => (
              <li key={c}>
                <Link
                  href={categoryHref(c)}
                  className="small-text"
                  style={{
                    display: 'inline-block', padding: '7px 14px',
                    border: '1px solid var(--line)', borderRadius: 999,
                    color: 'var(--ink-700)', textDecoration: 'none',
                    background: 'var(--paper2, #faf6ee)',
                  }}
                >
                  {c}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <CollectionsSection collections={collections} />
      <RealResults proof={socialProof} />
      <JournalSection posts={journalPosts} />
      <WhatsAppBand hasNumber={Boolean(settings.store_whatsapp || settings.store_phone)} />
    </main>
  );
}
