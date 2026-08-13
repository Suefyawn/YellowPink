export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { BulkEditProductsGrid, type BulkEditRow } from '@/components/admin/BulkEditProductsGrid';

// Shopify's bulk editor: the products chosen on the list, as one editable
// spreadsheet. Reached from the list's selection bar ("Bulk edit").

export default async function BulkEditPage({
  searchParams,
}: { searchParams: Promise<{ ids?: string }> }) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products.edit'))) {
    return <NoAccess section="Bulk edit" />;
  }

  const { ids: idsParam } = await searchParams;
  const ids = (idsParam ?? '').split(',').filter(Boolean).slice(0, 200);

  const admin = supabaseAdmin();
  const [{ data: rows }, { data: variantRows }] = ids.length
    ? await Promise.all([
        admin
          .from('products')
          .select('id, name, brand, status, price, original_price, cost_price, stock, stock_mode, track_inventory')
          .in('id', ids)
          .neq('status', 'archived'),
        admin.from('product_variants').select('product_id, stock, enabled').in('product_id', ids),
      ])
    : [{ data: [] }, { data: [] }];

  const variantTotals = new Map<string, number>();
  const hasVariants = new Set<string>();
  for (const v of (variantRows ?? []) as Array<{ product_id: string; stock: number | null; enabled: boolean }>) {
    hasVariants.add(v.product_id);
    if (v.enabled) variantTotals.set(v.product_id, (variantTotals.get(v.product_id) ?? 0) + (v.stock ?? 0));
  }

  // Preserve the order the ids arrived in (the list's visual order).
  const byId = new Map(((rows ?? []) as BulkEditRow[]).map(r => [r.id, r]));
  const products: BulkEditRow[] = ids
    .map(id => byId.get(id))
    .filter((p): p is BulkEditRow => Boolean(p))
    .map(p => ({
      ...p,
      has_variants: hasVariants.has(p.id),
      variant_stock: variantTotals.get(p.id) ?? 0,
    }));

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin/products" style={{ fontSize: '0.8125rem', color: '#6b7280', textDecoration: 'none' }}>← Products</Link>
        <h1 style={{ margin: '6px 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Bulk edit</h1>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
          {products.length} product{products.length === 1 ? '' : 's'}. Edit any cell, then save once —
          only the rows you changed are written. Stock edits land in Movement history.
        </p>
      </div>
      {products.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: 48, textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          Nothing selected. Tick products on the list, then choose <strong>Bulk edit</strong>.
        </div>
      ) : (
        <BulkEditProductsGrid products={products} />
      )}
    </div>
  );
}
