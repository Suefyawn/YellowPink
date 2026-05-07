export const dynamic = 'force-dynamic';

import { getProductsByTag, getProductsByCategoryAndTag } from '@/lib/supabase';
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
  const [bestsellers, saleProducts, wellnessProducts] = await Promise.all([
    getProductsByTag('Bestseller', 8),
    getProductsByTag('Sale', 4),
    getProductsByCategoryAndTag('Wellness', 3),
  ]);

  return (
    <main className="fade-in">
      <HeroSection />
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
