'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import { useWishlist } from '@/context/WishlistContext';
import { getBrowserClient } from '@/lib/supabase-browser';
import type { Product } from '@/types';

export function WishlistPage() {
  const { wishlist } = useWishlist();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (wishlist.length === 0) { setLoading(false); return; }
    const sb = getBrowserClient();
    sb.from('products').select('*').in('id', wishlist).then(({ data }) => {
      if (data) setProducts(data as Product[]);
      setLoading(false);
    });
  }, [wishlist]);

  if (loading) {
    return (
      <section style={{ padding: 'var(--section-gap) 0', textAlign: 'center' }}>
        <div className="container"><p className="body-text" style={{ color: 'var(--ink-500)' }}>Loading…</p></div>
      </section>
    );
  }

  if (wishlist.length === 0) {
    return (
      <section style={{ padding: 'var(--section-gap) 0', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 560 }}>
          <h1 className="h1" style={{ marginTop: 20, marginBottom: 12 }}>Your wishlist is empty</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 28 }}>
            Tap the heart on any product to save it here.
          </p>
          <Link href="/shop" className="btn-primary">Browse Products</Link>
        </div>
      </section>
    );
  }

  return (
    <div>
      <section style={{ padding: '48px 0', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Saved Items</Overline>
          <h1 className="display-l" style={{ fontSize: '2rem' }}>Wishlist ({products.length})</h1>
        </div>
      </section>

      <section style={{ padding: 'var(--section-gap) 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }} className="product-grid">
            {products.map(p => (
              <Link key={p.id} href={`/product/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <ProductTile product={p} />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
