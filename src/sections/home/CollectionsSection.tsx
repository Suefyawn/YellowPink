import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { CollectionsGrid } from '@/components/ui/CollectionsGrid';
import type { Collection } from '@/lib/collections';

// "Shop by collection", surfaces the curated edits on the homepage. Renders
// nothing when there are no published collections, so the homepage degrades
// cleanly before any are created.
export function CollectionsSection({ collections }: { collections: Collection[] }) {
  if (collections.length === 0) return null;
  return (
    <section style={{ paddingBottom: 'var(--section-gap)' }}>
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
          <div>
            <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Curated for you</Overline>
            <h2 className="display-l" style={{ fontSize: '2.25rem', margin: 0 }}>Shop by collection</h2>
          </div>
          <Link href="/collections" className="text-link">View all collections</Link>
        </div>
        <CollectionsGrid collections={collections.slice(0, 3)} />
      </div>
    </section>
  );
}
