// 5-min ISR, same cadence as the homepage — the edit changes only when
// products are published or the brand list grows.
export const revalidate = 300;

import type { Metadata } from 'next';
import { getProductsByBrands } from '@/lib/supabase';
import { K_BEAUTY_BRANDS, K_BEAUTY_FAQ, K_BEAUTY_PAGE_URL } from '@/lib/k-beauty';
import { KBeautyCollection } from '@/sections/kbeauty/KBeautyCollection';
import { pageMeta, jsonLd, breadcrumbLd, itemListLd, faqLd, absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'K-Beauty — Authentic Korean Skincare in Pakistan',
  description:
    'Shop the K-Beauty Edit: Beauty of Joseon, SKIN1004 and more — authentic Korean sunscreens, ampoules and glass-skin essentials with COD nationwide in Pakistan.',
  path: K_BEAUTY_PAGE_URL,
  image: absoluteUrl('/k-beauty/hero.webp'),
});

export default async function KBeautyPage() {
  const products = await getProductsByBrands(K_BEAUTY_BRANDS, 24);

  const breadcrumb = [
    { name: 'Home', path: '/' },
    { name: 'K-Beauty', path: K_BEAUTY_PAGE_URL },
  ];

  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd(breadcrumb)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(itemListLd(
            'K-Beauty',
            products.map(p => ({ name: p.name, path: `/product/${p.slug}` })),
          )),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqLd([...K_BEAUTY_FAQ])) }}
      />
      <KBeautyCollection products={products} />
    </main>
  );
}
