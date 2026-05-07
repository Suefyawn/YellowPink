export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { deleteProduct } from '@/app/admin/actions';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { ProductsFilter } from '@/components/admin/ProductsFilter';
import { Pagination } from '@/components/admin/Pagination';
import type { Product } from '@/types';

const PAGE_SIZE = 25;

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tag?: string; q?: string; page?: string }>;
}) {
  const { category, tag, q, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let countQuery = supabase.from('products').select('*', { count: 'exact', head: true });
  let dataQuery = supabase.from('products').select('*').order('created_at', { ascending: false }).range(from, to);

  if (category && category !== 'All') {
    countQuery = countQuery.eq('category', category);
    dataQuery = dataQuery.eq('category', category);
  }
  if (tag && tag !== 'All') {
    countQuery = countQuery.eq('tag', tag);
    dataQuery = dataQuery.eq('tag', tag);
  }
  if (q) {
    const filter = `name.ilike.%${q}%,brand.ilike.%${q}%`;
    countQuery = countQuery.or(filter);
    dataQuery = dataQuery.or(filter);
  }

  const [{ count: totalCount }, { data: products }] = await Promise.all([countQuery, dataQuery]);
  const total = totalCount ?? 0;
  const list = (products ?? []) as Product[];

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Products</h1>
        <Link href="/admin/products/new" style={{
          padding: '10px 20px', background: '#ec4899', color: 'white',
          borderRadius: 8, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          + New Product
        </Link>
      </div>

      <Suspense fallback={null}>
        <ProductsFilter total={total} />
      </Suspense>

      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {list.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af' }}>
            No products found. <Link href="/admin/products/new" style={{ color: '#ec4899' }}>Add one →</Link>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Brand / Name', 'Price', 'Stock', 'Category', 'Tag', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p, i) => {
                const lowStock = p.stock > 0 && p.stock <= 10;
                const outOfStock = p.stock === 0;
                return (
                  <tr key={p.id} style={{
                    borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
                    background: outOfStock ? '#fef2f2' : lowStock ? '#fffbeb' : 'transparent',
                  }}>
                    <td style={{ padding: '12px 16px', maxWidth: 260 }}>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 1 }}>{p.brand}</div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      {p.variant && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 1 }}>{p.variant}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                      {fmt(p.price)}
                      {p.original_price && (
                        <div style={{ color: '#9ca3af', fontWeight: 400, textDecoration: 'line-through', fontSize: '0.75rem' }}>
                          {fmt(p.original_price)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                        background: outOfStock ? '#fef2f2' : lowStock ? '#fffbeb' : '#f0fdf4',
                        color: outOfStock ? '#dc2626' : lowStock ? '#d97706' : '#16a34a',
                        border: `1px solid ${outOfStock ? '#fecaca' : lowStock ? '#fde68a' : '#bbf7d0'}`,
                      }}>
                        {outOfStock ? '✕ Out of stock' : lowStock ? `⚠ ${p.stock} left` : `✓ ${p.stock}`}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#374151' }}>{p.category}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {p.tag ? (
                        <span style={{ display: 'inline-block', padding: '2px 8px', background: '#fdf2f8', borderRadius: 20, fontSize: '0.75rem', fontWeight: 500, color: '#9d174d' }}>
                          {p.tag}
                        </span>
                      ) : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link href={`/admin/products/${p.id}`} style={{
                          padding: '5px 12px', background: '#f3f4f6', color: '#374151',
                          borderRadius: 6, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 500,
                        }}>
                          Edit
                        </Link>
                        <DeleteButton id={p.id} action={deleteProduct} confirmMsg={`Delete "${p.name}"?`} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Suspense fallback={null}>
        <Pagination total={total} pageSize={PAGE_SIZE} currentPage={page} basePath="/admin/products" />
      </Suspense>
    </div>
  );
}
