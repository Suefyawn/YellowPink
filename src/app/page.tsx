export const dynamic = 'force-dynamic';

import { getProducts } from '@/lib/supabase';
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
  const products = await getProducts();
  return (
    <main className="fade-in">
      <HeroSection />
      <TrustBar />
      <FeaturedProducts products={products} />
      <EditorialDuo />
      <NewArrivals products={products} />
      <BestsellersBand products={products} />
      <WellnessSection products={products} />
      <CategoryTiles />
      <RealResults />
      <PressStrip />
    </main>
  );
}
