export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { ProductsTable } from '@/components/admin/ProductsTable';
import { ProductsFilter } from '@/components/admin/ProductsFilter';
import { ProductsFlash } from '@/components/admin/ProductsFlash';
import { AdminFab } from '@/components/admin/AdminFab';
import { ResubmitAllButton } from '@/components/admin/IndexingButtons';
import { Pagination } from '@/components/admin/Pagination';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { findTaxon } from '@/lib/category-taxonomy';
import type { Product } from '@/types';

const PAGE_SIZE = 25;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string; tag?: string; ptag?: string; q?: string; page?: string; sort?: string;
    deleted?: string; archived?: string; error?: string;
  }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products.view'))) {
    return <NoAccess section="Products" />;
  }
  const { category, tag, ptag, q, page: pageParam, sort, deleted, archived, error } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Sort options mirror the dropdown in ProductsFilter.
  const SORT_MAP: Record<string, { col: string; asc: boolean }> = {
    newest:     { col: 'created_at', asc: false },
    name:       { col: 'name',       asc: true },
    price_high: { col: 'price',      asc: false },
    price_low:  { col: 'price',      asc: true },
    stock_low:  { col: 'stock',      asc: true },
    stock_high: { col: 'stock',      asc: false },
  };
  const order = SORT_MAP[sort ?? 'newest'] ?? SORT_MAP.newest;

  // ?ptag=<slug> filters by a many-to-many product tag (the Tags manager links
  // here). Resolve the slug to its product id set up front so both queries can
  // constrain on it. A slug with no products yields an empty (impossible) set.
  let ptagName: string | null = null;
  let ptagProductIds: string[] | null = null;
  if (ptag) {
    const { data: tagRow } = await supabase.from('product_tags').select('id, name').eq('slug', ptag).maybeSingle();
    ptagName = (tagRow as { name?: string } | null)?.name ?? ptag;
    const tagId = (tagRow as { id?: string } | null)?.id;
    if (tagId) {
      const { data: mapRows } = await supabase.from('product_tag_map').select('product_id').eq('tag_id', tagId);
      ptagProductIds = ((mapRows ?? []) as Array<{ product_id: string }>).map(r => r.product_id);
    } else {
      ptagProductIds = [];
    }
  }

  let countQuery = supabase.from('products').select('*', { count: 'exact', head: true });
  let dataQuery = supabase.from('products').select('*').order(order.col, { ascending: order.asc }).range(from, to);

  if (ptagProductIds) {
    // `.in('id', [])` returns nothing — the correct result for a tag with no
    // products (rather than silently ignoring the filter).
    const ids = ptagProductIds.length > 0 ? ptagProductIds : ['00000000-0000-0000-0000-000000000000'];
    countQuery = countQuery.in('id', ids);
    dataQuery = dataQuery.in('id', ids);
  }

  if (category && category !== 'All') {
    // The filter pills are top-level taxons (Makeup / Skincare / Wellness /
    // Bundles), but products store fine-grained leaf categories ("Women's
    // Health", "Immunity", …). Expand a taxon to its leaf set so e.g.
    // "Wellness" matches its supplements instead of an exact (empty) match.
    const taxon = findTaxon(category);
    if (taxon) {
      const leaves = [...taxon.categories];
      countQuery = countQuery.in('category', leaves);
      dataQuery = dataQuery.in('category', leaves);
    } else {
      countQuery = countQuery.eq('category', category);
      dataQuery = dataQuery.eq('category', category);
    }
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ResubmitAllButton />
          <Link href="/admin/products/import" style={{
            padding: '10px 16px', background: 'white', color: '#111827',
            border: '1px solid #d1d5db', borderRadius: 8, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
          }}>
            Import CSV
          </Link>
          <Link href="/admin/products/new" style={{
            padding: '10px 20px', background: '#C5286A', color: 'white',
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

      {ptag && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontSize: '0.8125rem', color: '#374151' }}>
          <span style={{ padding: '4px 10px', borderRadius: 20, background: '#fce7f3', color: '#9d174d', fontWeight: 600 }}>
            Tag: {ptagName}
          </span>
          <Link href="/admin/products" style={{ color: '#6b7280', textDecoration: 'none' }}>Clear ✕</Link>
        </div>
      )}

      <ProductsFlash deleted={!!deleted} archived={!!archived} error={error} />

      <ProductsTable products={list} />

      <Suspense fallback={null}>
        <Pagination total={total} pageSize={PAGE_SIZE} currentPage={page} basePath="/admin/products" />
      </Suspense>

      <AdminFab href="/admin/products/new" label="New product" />
    </div>
  );
}
