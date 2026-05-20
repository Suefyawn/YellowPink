// 5-min ISR — featured products / new arrivals / hero copy change at most
// every few hours, and the global cache header in next.config.ts already
// puts a CDN in front. Was `force-dynamic` before the 2026-05-24 audit.
export const revalidate = 300;

import {
  getBestsellers,
  getFeatured,
  getOnSale,
  getProductsByTaxon,
  getSiteSettings,
  getCategoryTileImages,
} from '@/lib/supabase';

// Homepage "Shop by category" tiles — four makeup/skincare + four wellness,
// equal billing for the "beauty, inside out" concept.
const MAKEUP_TILE_CATS = ['Lip & Cheek Tints', 'Highlighters', 'Face Makeup', 'Skincare'];
const WELLNESS_TILE_CATS = ["Women's Health", "Men's Health", 'Immunity', 'Bone & Joint'];
import { HeroSection } from '@/sections/home/HeroSection';
import { TrustBar } from '@/sections/home/TrustBar';
import { FeaturedProducts } from '@/sections/home/FeaturedProducts';
import { EditorialDuo } from '@/sections/home/EditorialDuo';
import { NewArrivals } from '@/sections/home/NewArrivals';
import { BestsellersBand } from '@/sections/home/BestsellersBand';
import { WellnessSection } from '@/sections/home/WellnessSection';
import { CategoryTiles } from '@/sections/home/CategoryTiles';
import { RealResults } from '@/sections/home/RealResults';
import { PressStrip } from '@/sections/home/PressStrip';

export default async function HomePage() {
  // Pull each rail in parallel. The new helpers all fall back to a stock-
  // /recency-ordered slice of the live catalog if their flag-based query
  // returns fewer rows than requested, so empty sections shouldn't happen
  // once the catalog has any products. Migration 076 backfilled
  // is_featured + is_bestseller; the queries respect those first.
  const [featured, bestsellers, saleProducts, wellnessProducts, settings, categoryImages] = await Promise.all([
    getFeatured(6),
    getBestsellers(8),
    getOnSale(4),
    getProductsByTaxon('wellness', 4),
    getSiteSettings(),
    getCategoryTileImages([...MAKEUP_TILE_CATS, ...WELLNESS_TILE_CATS]),
  ]);

  const tile = (label: string) => ({
    label,
    href: `/shop?category=${encodeURIComponent(label)}`,
    image: categoryImages[label],
  });
  const categoryGroups = [
    { title: 'Makeup & Skincare', tiles: MAKEUP_TILE_CATS.map(tile) },
    { title: 'Health & Wellness', tiles: WELLNESS_TILE_CATS.map(tile) },
  ];

  const heroSettings = {
    overline: settings.hero_overline,
    headline: settings.hero_headline,
    subline: settings.hero_subline,
    cta1Text: settings.hero_cta1_text,
    cta1Url: settings.hero_cta1_url,
    cta2Text: settings.hero_cta2_text,
    cta2Url: settings.hero_cta2_url,
    imageUrl: settings.hero_image_url,
    brands: settings.hero_brands ? settings.hero_brands.split(',').map(b => b.trim()) : [],
  };

  return (
    <main className="fade-in">
      <HeroSection settings={heroSettings} />
      <TrustBar />
      <FeaturedProducts products={featured.length ? featured.slice(0, 4) : bestsellers.slice(0, 4)} />
      <EditorialDuo />
      <NewArrivals products={saleProducts} />
      <BestsellersBand products={bestsellers.slice(0, 4)} />
      <WellnessSection products={wellnessProducts} />
      <CategoryTiles groups={categoryGroups} />
      <RealResults />
      <PressStrip />
    </main>
  );
}
