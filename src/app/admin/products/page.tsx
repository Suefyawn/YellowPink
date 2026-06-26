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

// Minimal filter-builder shape so the same chain applies to both the data
// query and the (differently-typed) head count queries. Cast is localised to
// applyShared; callers keep their concrete builder type.
interface FilterBuilder {
  eq(col: string, val: unknown): FilterBuilder;
  gt(col: string, val: unknown): FilterBuilder;
  gte(col: string, val: unknown): FilterBuilder;
  lte(col: string, val: unknown): FilterBuilder;
  in(col: string, vals: readonly unknown[]): FilterBuilder;
  or(filter: string): FilterBuilder;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string; tag?: string; ptag?: string; q?: string; page?: string; sort?: string;
    status?: string; brand?: string; stock?: string; min?: string; max?: string;
    deleted?: string; archived?: string; error?: string;
  }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products.view'))) {
    return <NoAccess section="Products" />;
  }
  const sp = await searchParams;
  const { category, tag, ptag, q, sort, status, brand, stock } = sp;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const min = sp.min && /^\d+$/.test(sp.min) ? Number(sp.min) : null;
  const max = sp.max && /^\d+$/.test(sp.max) ? Number(sp.max) : null;

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

  // Apply every filter EXCEPT status, shared by the data query and the
  // per-status count queries (so the status tabs reflect the other filters).
  const applyShared = <T,>(qb: T): T => {
    let b = qb as unknown as FilterBuilder;
    if (ptagProductIds) {
      const ids = ptagProductIds.length > 0 ? ptagProductIds : ['00000000-0000-0000-0000-000000000000'];
      b = b.in('id', ids);
    }
    if (category && category !== 'All') {
      // The category control emits either a top-level taxon (Makeup / Skincare
      // / Wellness / Bundles) or an exact leaf ("Women's Health"). A taxon
      // expands to its leaf set; a leaf matches exactly.
      const taxon = findTaxon(category);
      if (taxon) b = b.in('category', [...taxon.categories]);
      else b = b.eq('category', category);
    }
    if (brand) b = b.eq('brand', brand);
    if (tag && tag !== 'All') b = b.eq('tag', tag);
    if (q) b = b.or(`name.ilike.%${q}%,brand.ilike.%${q}%`);
    // Stock state. Tracked products only, except "managed" (externally managed).
    if (stock === 'in')        b = b.eq('track_inventory', true).gt('stock', 0);
    else if (stock === 'low')  b = b.eq('track_inventory', true).gt('stock', 0).lte('stock', 10);
    else if (stock === 'out')  b = b.eq('track_inventory', true).eq('stock', 0);
    else if (stock === 'managed') b = b.eq('track_inventory', false);
    if (min != null) b = b.gte('price', min);
    if (max != null) b = b.lte('price', max);
    return b as unknown as T;
  };

  const headCount = () => supabase.from('products').select('id', { count: 'exact', head: true });
  const activeStatus = status && status !== 'all' ? status : null;

  let dataQuery = applyShared(supabase.from('products').select('*'))
    .order(order.col, { ascending: order.asc }).range(from, to);
  if (activeStatus) dataQuery = dataQuery.eq('status', activeStatus);

  // Count per status (shared filters applied) drives the tab badges + the
  // current pagination total.
  const [
    { data: products },
    { count: cPublished },
    { count: cDraft },
    { count: cArchived },
  ] = await Promise.all([
    dataQuery,
    applyShared(headCount()).eq('status', 'published'),
    applyShared(headCount()).eq('status', 'draft'),
    applyShared(headCount()).eq('status', 'archived'),
  ]);

  const statusCounts = {
    published: cPublished ?? 0,
    draft: cDraft ?? 0,
    archived: cArchived ?? 0,
    all: (cPublished ?? 0) + (cDraft ?? 0) + (cArchived ?? 0),
  };
  const total = activeStatus
    ? (statusCounts[activeStatus as keyof typeof statusCounts] ?? 0)
    : statusCounts.all;
  const list = (products ?? []) as Product[];

  // Distinct categories + brands for the filter dropdowns (cheap over the whole
  // catalogue). Categories cover any value present, including ones outside the
  // nav taxonomy (e.g. Sunscreens, Fragrance).
  const { data: facetRows } = await supabase.from('products').select('category, brand');
  const catSet = new Set<string>();
  const brandSet = new Set<string>();
  for (const r of (facetRows ?? []) as Array<{ category: string | null; brand: string | null }>) {
    if (r.category) catSet.add(r.category);
    if (r.brand) brandSet.add(r.brand);
  }
  const categories = [...catSet].sort((a, b) => a.localeCompare(b));
  const brands = [...brandSet].sort((a, b) => a.localeCompare(b));

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
        <ProductsFilter total={total} statusCounts={statusCounts} categories={categories} brands={brands} />
      </Suspense>

      {ptag && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontSize: '0.8125rem', color: '#374151' }}>
          <span style={{ padding: '4px 10px', borderRadius: 20, background: '#fce7f3', color: '#9d174d', fontWeight: 600 }}>
            Tag: {ptagName}
          </span>
          <Link href="/admin/products" style={{ color: '#6b7280', textDecoration: 'none' }}>Clear ✕</Link>
        </div>
      )}

      <ProductsFlash deleted={!!sp.deleted} archived={!!sp.archived} error={sp.error} />

      <ProductsTable products={list} />

      <Suspense fallback={null}>
        <Pagination total={total} pageSize={PAGE_SIZE} currentPage={page} basePath="/admin/products" />
      </Suspense>

      <AdminFab href="/admin/products/new" label="New product" />
    </div>
  );
}
