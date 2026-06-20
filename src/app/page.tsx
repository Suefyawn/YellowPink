// 5-min ISR — featured products / new arrivals / hero copy change at most
// every few hours, and the global cache header in next.config.ts already
// puts a CDN in front. Was `force-dynamic` before the 2026-05-24 audit.
export const revalidate = 300;

import {
  getBestsellers,
  getFeatured,
  getOnSale,
  getProductsByTaxon,
  getProductsByBrands,
  getSiteSettings,
  getBlogPosts,
} from '@/lib/supabase';
import { K_BEAUTY_BRANDS } from '@/lib/k-beauty';
import { getPublishedCollectionsWithCovers } from '@/lib/collections-data';

// Homepage "Shop by category" tiles — four makeup/skincare + four wellness,
// equal billing for the "beauty, inside out" concept.
const MAKEUP_TILE_CATS = ['Lip & Cheek Tints', 'Highlighters', 'Face Makeup', 'Cleansers & Treatments'];
const WELLNESS_TILE_CATS = ["Women's Health", "Men's Health", 'Immunity', 'Bone & Joint'];

// Curated editorial image per tile category, hosted in this project's
// Supabase Storage `images` bucket. Replaces the old approach of surfacing
// one random in-stock product photo per category — those varied wildly in
// framing/lighting and made the section look incoherent. These are
// purpose-shot on a shared cream backdrop. The base URL is derived from the
// configured project so a no-Supabase demo build resolves to `undefined` and
// the tile falls back to its gradient placeholder instead of 404-ing.
const CATEGORY_IMAGE_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/categories`
  : null;
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
import { BestsellersBand } from '@/sections/home/BestsellersBand';
import { WellnessSection } from '@/sections/home/WellnessSection';
import { KBeautySection } from '@/sections/home/KBeautySection';
import { CategoryTiles } from '@/sections/home/CategoryTiles';
import { CollectionsSection } from '@/sections/home/CollectionsSection';
import { RealResults } from '@/sections/home/RealResults';
import { JournalSection } from '@/sections/home/JournalSection';
import { PressStrip } from '@/sections/home/PressStrip';

export default async function HomePage() {
  // Pull each rail in parallel. The new helpers all fall back to a stock-
  // /recency-ordered slice of the live catalog if their flag-based query
  // returns fewer rows than requested, so empty sections shouldn't happen
  // once the catalog has any products. Migration 076 backfilled
  // is_featured + is_bestseller; the queries respect those first.
  const [featured, bestsellers, saleProducts, wellnessProducts, kBeautyProducts, settings, blogPosts, collections] = await Promise.all([
    getFeatured(6),
    getBestsellers(8),
    getOnSale(8),
    getProductsByTaxon('wellness', 4),
    getProductsByBrands(K_BEAUTY_BRANDS, 4),
    getSiteSettings(),
    getBlogPosts(),
    getPublishedCollectionsWithCovers(3),
  ]);

  // The featured sale collection is shown only while a sale is switched on
  // in Admin → Settings → Sale (the central on/off switch).
  const saleActive = settings.sale_active === 'true';

  const tile = (label: string) => ({
    label,
    href: `/shop?category=${encodeURIComponent(label)}`,
    image: CATEGORY_IMAGE_BASE ? `${CATEGORY_IMAGE_BASE}/${CATEGORY_TILE_FILES[label]}` : undefined,
  });
  const categoryGroups = [
    { title: 'Makeup & Skincare', tiles: MAKEUP_TILE_CATS.map(tile) },
    { title: 'Health & Wellness', tiles: WELLNESS_TILE_CATS.map(tile) },
  ];

  // Seasonal hero override — while the seasonal makeover is on, the homepage
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
      <HeroSection settings={heroSettings} />
      <TrustBar />
      <FeaturedProducts products={featured.length ? featured.slice(0, 4) : bestsellers.slice(0, 4)} />
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
      <BestsellersBand products={bestsellers.slice(0, 4)} />
      <WellnessSection products={wellnessProducts} />
      <CategoryTiles groups={categoryGroups} />
      <CollectionsSection collections={collections} />
      <RealResults />
      <JournalSection posts={blogPosts} />
      <PressStrip />
    </main>
  );
}
