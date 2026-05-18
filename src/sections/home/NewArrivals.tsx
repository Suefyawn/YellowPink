import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import type { Product } from '@/types';

export function NewArrivals({ products }: { products: Product[] }) {
  const items = products.slice(0, 4);
  return (
    <section style={{ paddingBottom: 'var(--section-gap)' }}>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <Overline>New Arrivals</Overline>
          <Link href="/shop" className="text-link">View All</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }} className="product-grid">
          {items.map((p) => (
            <Link key={p.id} href={`/product/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <ProductTile product={p} />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
