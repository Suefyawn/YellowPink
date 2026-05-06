export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { deleteProduct } from '@/app/admin/actions';
import { DeleteButton } from '@/components/admin/DeleteButton';
import type { Product } from '@/types';

const fmt = (n: number) => `Rs ${n.toLocaleString()}`;

export default async function ProductsPage() {
  const { data: products } = await supabase.from('products').select('*').order('created_at', { ascending: false });

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Products</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>{products?.length ?? 0} items</p>
        </div>
        <Link href="/admin/products/new" style={{
          padding: '10px 20px', background: '#ec4899', color: 'white',
          borderRadius: 8, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          + New Product
        </Link>
      </div>

      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {!products || products.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af' }}>
            No products yet. <Link href="/admin/products/new" style={{ color: '#ec4899' }}>Add the first one →</Link>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Brand', 'Name', 'Price', 'Stock', 'Category', 'Tag', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(products as Product[]).map((p, i) => (
                <tr key={p.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#6b7280' }}>{p.brand}</td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 500, color: '#111827', maxWidth: 200 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    {p.variant && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 1 }}>{p.variant}</div>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                    {fmt(p.price)}
                    {p.original_price && (
                      <span style={{ color: '#9ca3af', fontWeight: 400, textDecoration: 'line-through', marginLeft: 6, fontSize: '0.8125rem' }}>
                        {fmt(p.original_price)}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 20,
                      fontSize: '0.75rem', fontWeight: 600,
                      background: p.stock === 0 ? '#fef2f2' : p.stock < 5 ? '#fffbeb' : '#f0fdf4',
                      color: p.stock === 0 ? '#dc2626' : p.stock < 5 ? '#d97706' : '#16a34a',
                    }}>
                      {p.stock}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#374151' }}>{p.category}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {p.tag ? (
                      <span style={{ display: 'inline-block', padding: '2px 8px', background: '#fdf2f8', borderRadius: 20, fontSize: '0.75rem', fontWeight: 500, color: '#9d174d' }}>
                        {p.tag}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link href={`/admin/products/${p.id}`} style={{
                        padding: '5px 12px', background: '#f3f4f6', color: '#374151',
                        borderRadius: 6, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 500,
                      }}>
                        Edit
                      </Link>
                      <DeleteButton
                        id={p.id}
                        action={deleteProduct}
                        confirmMsg={`Delete "${p.name}"?`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
