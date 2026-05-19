// 5-min ISR — featured products / new arrivals / hero copy change at most
// every few hours, and the global cache header in next.config.ts already
// puts a CDN in front. Was `force-dynamic` before the 2026-05-24 audit.
export const revalidate = 300;

import { getProductsByTag, getProductsByCategoryAndTag, getSiteSettings } from '@/lib/supabase';
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
  const [bestsellers, saleProducts, wellnessProducts, settings] = await Promise.all([
    getProductsByTag('Bestseller', 8),
    getProductsByTag('Sale', 4),
    getProductsByCategoryAndTag('Wellness', 3),
    getSiteSettings(),
  ]);

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
      <FeaturedProducts products={bestsellers.slice(0, 4)} />
      <EditorialDuo />
      <NewArrivals products={saleProducts} />
      <BestsellersBand products={bestsellers.slice(4, 7)} />
      <WellnessSection products={wellnessProducts} />
      <CategoryTiles />
      <RealResults />
      <PressStrip />
    </main>
  );
}
