export const revalidate = 300;

import type { Metadata } from 'next';
import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { CollectionsGrid } from '@/components/ui/CollectionsGrid';
import { getPublishedCollectionsWithCovers } from '@/lib/collections-data';
import { pageMeta, jsonLd, breadcrumbLd } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta({
    title: 'Beauty & Wellness Collections in Pakistan',
    description: 'Shop curated beauty and wellness collections at Yellow Pink, bestsellers, the skincare edit, makeup, supplements and value bundles. Authentic, with cash on delivery across Pakistan.',
    path: '/collections',
  });
}

export default async function CollectionsIndexPage() {
  const collections = await getPublishedCollectionsWithCovers();

  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Collections', path: '/collections' }])) }}
      />
      <section style={{ padding: '48px 0 0' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Curated for you</Overline>
          <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>Beauty &amp; Wellness Collections</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 520, marginBottom: 32 }}>
            Handpicked and smart edits, the easiest way to find your next favourite.
          </p>
        </div>
      </section>

      <section style={{ paddingBottom: 'var(--section-gap)' }}>
        <div className="container">
          {collections.length === 0 ? (
            <p className="body-text" style={{ color: 'var(--ink-700)' }}>
              No collections yet, <Link href="/shop" className="text-link">browse the full catalogue</Link>.
            </p>
          ) : (
            <CollectionsGrid collections={collections} />
          )}
        </div>
      </section>
    </main>
  );
}
