export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { ProductsTable } from '@/components/admin/ProductsTable';
import { ProductsFilter } from '@/components/admin/ProductsFilter';
import { Pagination } from '@/components/admin/Pagination';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import type { Product } from '@/types';

const PAGE_SIZE = 25;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tag?: string; q?: string; page?: string }>;
}) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('products')) {
    return <NoAccess section="Products" />;
  }
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
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Products</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/admin/products/import" style={{
            padding: '10px 16px', background: 'white', color: '#111827',
            border: '1px solid #d1d5db', borderRadius: 8, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
          }}>
            Import CSV
          </Link>
          <Link href="/admin/products/new" style={{
            padding: '10px 20px', background: '#ec4899', color: 'white',
            borderRadius: 8, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            + New Product
          </Link>
        </div>
      </div>

      <Suspense fallback={null}>
        <ProductsFilter total={total} />
      </Suspense>

      <ProductsTable products={list} />

      <Suspense fallback={null}>
        <Pagination total={total} pageSize={PAGE_SIZE} currentPage={page} basePath="/admin/products" />
      </Suspense>
    </div>
  );
}
