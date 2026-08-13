'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';
import type { Permission } from '@/lib/permissions';
import { reconcileStock } from '@/lib/stock-writes';
import { revalidateStorefrontCatalog } from '@/lib/revalidate-storefront';

async function assertProducts(action: 'edit' | 'delete' = 'edit') {
  const session = await getStaffSession();
  const perm: Permission = action === 'delete' ? 'products.delete' : 'products.edit';
  if (!session || (!session.isOwner && !session.permissions.includes(perm))) {
    throw new Error('Unauthorized');
  }
  return session;
}

// Every write checks its error and returns it to the caller (ProductsTable
// shows a toast) instead of silently revalidating, see issue #191.

// ─── Single-row inline quick edit (price / stock / status) ─────────────────
export async function quickUpdateProduct(
  id: string,
  patch: { price?: number; stock?: number; status?: string },
): Promise<{ error?: string }> {
  const session = await assertProducts();
  const update: Record<string, unknown> = {};
  if (patch.price != null && Number.isFinite(patch.price) && patch.price >= 0) update.price = patch.price;
  if (patch.status && ['published', 'draft', 'archived'].includes(patch.status)) update.status = patch.status;
  // Stock is deliberately NOT in `update`: an inline cell edit is still a stock
  // movement and belongs in the ledger like any other, so it goes through
  // reconcileStock below rather than a bare column write.
  const wantsStock = patch.stock != null && Number.isInteger(patch.stock) && patch.stock >= 0;
  if (Object.keys(update).length === 0 && !wantsStock) return { error: 'Nothing to update' };
  if (Object.keys(update).length > 0) {
    const { error } = await supabaseAdmin().from('products').update(update).eq('id', id);
    if (error) {
      log.error('product.quick_update_failed', { id, error: error.message });
      return { error: error.message };
    }
  }
  if (wantsStock) {
    await reconcileStock({ productId: id, nextStock: patch.stock!, actor: session, note: 'Inline edit on the Products list' });
  }
  await logAudit(session, { action: 'product.quick_update', entity: 'product', entity_id: id, diff: { ...update, ...(wantsStock ? { stock: patch.stock } : {}) } });
  revalidatePath('/admin/products');
  return {};
}

// ─── The bulk edit grid (Shopify's spreadsheet view) ───────────────────────
// One submit carries every selected product's status/price/compare-at/cost/
// stock; only rows that actually changed are written. Stock goes through the
// ledger and is only accepted for own-stock products without variants — a
// variant product's parent counter stays untouchable here just like on the
// product form.
export async function bulkEditProducts(
  _prev: { error?: string; success?: boolean; changed?: number } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean; changed?: number }> {
  const session = await assertProducts();
  const ids = String(formData.get('ids') ?? '').split(',').filter(Boolean);
  if (ids.length === 0 || ids.length > 200) return { error: 'Pick between 1 and 200 products.' };

  const admin = supabaseAdmin();
  const [{ data: rows, error: loadErr }, { data: variantRows }] = await Promise.all([
    admin
      .from('products')
      .select('id, status, price, original_price, cost_price, stock, stock_mode, track_inventory')
      .in('id', ids),
    admin.from('product_variants').select('product_id').in('product_id', ids),
  ]);
  if (loadErr) return { error: loadErr.message };
  const hasVariants = new Set(((variantRows ?? []) as Array<{ product_id: string }>).map(v => v.product_id));

  let changed = 0;
  let priceChanged = false;
  for (const p of (rows ?? []) as Array<{
    id: string; status: string; price: number; original_price: number | null;
    cost_price: number | null; stock: number; stock_mode: string | null; track_inventory: boolean | null;
  }>) {
    if (formData.get(`p__${p.id}__present`) !== '1') continue;

    const status = String(formData.get(`p__${p.id}__status`) ?? p.status);
    if (!['published', 'draft'].includes(status)) return { error: 'Bad status value.' };
    const price = Number(formData.get(`p__${p.id}__price`));
    if (!Number.isFinite(price) || price < 0) return { error: 'Every price has to be a number of at least 0.' };
    const compareRaw = String(formData.get(`p__${p.id}__compare`) ?? '').trim();
    const compare = compareRaw === '' ? null : Number(compareRaw);
    if (compare !== null && (!Number.isFinite(compare) || compare < 0)) return { error: 'Compare-at prices have to be numbers.' };
    const costRaw = String(formData.get(`p__${p.id}__cost`) ?? '').trim();
    const cost = costRaw === '' ? null : Number(costRaw);
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) return { error: 'Cost prices have to be numbers.' };

    const patch: Record<string, unknown> = {};
    if (status !== p.status) patch.status = status;
    if (price !== p.price) { patch.price = price; priceChanged = true; }
    if (compare !== (p.original_price ?? null)) patch.original_price = compare;
    if (cost !== (p.cost_price ?? null)) patch.cost_price = cost;

    const mode = p.stock_mode ?? (p.track_inventory === false ? 'untracked' : 'own');
    let stockChanged = false;
    let nextStock = p.stock;
    if (mode === 'own' && !hasVariants.has(p.id)) {
      const stockRaw = String(formData.get(`p__${p.id}__stock`) ?? '').trim();
      if (stockRaw !== '') {
        nextStock = Number(stockRaw);
        if (!Number.isInteger(nextStock) || nextStock < 0) return { error: 'Stock has to be a whole number of at least 0.' };
        stockChanged = nextStock !== p.stock;
      }
    }

    if (Object.keys(patch).length) {
      const { error } = await admin.from('products').update(patch).eq('id', p.id);
      if (error) return { error: `A row failed to save: ${error.message}` };
    }
    if (stockChanged) {
      await reconcileStock({ productId: p.id, nextStock, actor: session, note: 'Set on the bulk edit grid' });
    }
    if (Object.keys(patch).length || stockChanged) changed++;
  }

  if (changed > 0) {
    void logAudit(session, {
      action: 'product.bulk_edit', entity: 'product', entity_id: ids[0],
      diff: { ids: ids.length, rows_changed: changed },
    });
    revalidatePath('/admin/products');
    revalidateStorefrontCatalog();
    if (priceChanged) revalidatePath('/', 'layout');
  }
  return { success: true, changed };
}

// ─── Bulk status / tag / price ─────────────────────────────────────────────
export async function bulkPublishProducts(ids: string[]): Promise<{ error?: string }> {
  const session = await assertProducts();
  if (ids.length === 0) return {};
  const { error } = await supabaseAdmin().from('products').update({ status: 'published' }).in('id', ids);
  if (error) {
    log.error('product.bulk_publish_failed', { count: ids.length, error: error.message });
    return { error: `Could not publish: ${error.message}` };
  }
  await logAudit(session, { action: 'product.bulk_publish', entity: 'product', diff: { count: ids.length, ids } });
  revalidatePath('/admin/products');
  return {};
}

export async function bulkDraftProducts(ids: string[]): Promise<{ error?: string }> {
  const session = await assertProducts();
  if (ids.length === 0) return {};
  const { error } = await supabaseAdmin().from('products').update({ status: 'draft' }).in('id', ids);
  if (error) {
    log.error('product.bulk_draft_failed', { count: ids.length, error: error.message });
    return { error: `Could not unpublish: ${error.message}` };
  }
  await logAudit(session, { action: 'product.bulk_draft', entity: 'product', diff: { count: ids.length, ids } });
  revalidatePath('/admin/products');
  return {};
}

export async function bulkArchiveProducts(ids: string[]): Promise<{ error?: string }> {
  const session = await assertProducts();
  if (ids.length === 0) return {};
  const { error } = await supabaseAdmin().from('products').update({ status: 'archived' }).in('id', ids);
  if (error) {
    log.error('product.bulk_archive_failed', { count: ids.length, error: error.message });
    return { error: `Could not archive: ${error.message}` };
  }
  await logAudit(session, { action: 'product.bulk_archive', entity: 'product', diff: { count: ids.length, ids } });
  revalidatePath('/admin/products');
  return {};
}

export async function bulkDeleteProducts(ids: string[]): Promise<{ deleted: number; archived: number; error?: string }> {
  const session = await assertProducts('delete');
  if (ids.length === 0) return { deleted: 0, archived: 0 };

  // Products with order history are archived, not hard-deleted, see
  // src/lib/product-archive.ts for why. The rest are deleted as requested.
  const { productsWithOrderHistory } = await import('@/lib/product-archive');
  const referenced = await productsWithOrderHistory(ids);
  const toArchive = ids.filter(id => referenced.has(id));
  const toDelete = ids.filter(id => !referenced.has(id));

  const admin = supabaseAdmin();
  if (toArchive.length > 0) {
    const { error } = await admin.from('products').update({ status: 'archived' }).in('id', toArchive);
    if (error) {
      log.error('product.bulk_delete_archive_failed', { count: toArchive.length, error: error.message });
      return { deleted: 0, archived: 0, error: `Could not archive products with order history: ${error.message}` };
    }
  }
  if (toDelete.length > 0) {
    const { error } = await admin.from('products').delete().in('id', toDelete);
    if (error) {
      log.error('product.bulk_delete_failed', { count: toDelete.length, error: error.message });
      revalidatePath('/admin/products');
      return { deleted: 0, archived: toArchive.length, error: `Could not delete: ${error.message}` };
    }
  }
  await logAudit(session, {
    action: 'product.bulk_delete',
    entity: 'product',
    diff: { count: ids.length, deleted: toDelete, archived: toArchive },
  });
  revalidatePath('/admin/products');
  return { deleted: toDelete.length, archived: toArchive.length };
}

export async function bulkTagProducts(ids: string[], tag: string | null): Promise<{ error?: string }> {
  const session = await assertProducts();
  if (ids.length === 0) return {};
  const { error } = await supabaseAdmin().from('products').update({ tag }).in('id', ids);
  if (error) {
    log.error('product.bulk_tag_failed', { count: ids.length, tag, error: error.message });
    return { error: `Could not tag: ${error.message}` };
  }
  await logAudit(session, { action: 'product.bulk_tag', entity: 'product', diff: { count: ids.length, ids, tag } });
  revalidatePath('/admin/products');
  return {};
}

// percent (e.g. -10 = 10% off, +5 = 5% mark-up). Applies to current price.
export async function bulkPriceAdjustProducts(ids: string[], percent: number): Promise<{ error?: string }> {
  const session = await assertProducts();
  if (ids.length === 0) return {};
  if (!isFinite(percent) || percent <= -100) return { error: 'Invalid percent' };

  const { data } = await supabaseAdmin().from('products').select('id, price, original_price').in('id', ids);
  const failed: string[] = [];
  for (const row of (data ?? []) as Array<{ id: string; price: number; original_price: number | null }>) {
    const newPrice = Math.round(row.price * (1 + percent / 100));
    if (newPrice < 0) continue;
    const { error } = await supabaseAdmin().from('products').update({ price: newPrice }).eq('id', row.id);
    if (error) {
      log.error('product.bulk_price_adjust_failed', { id: row.id, percent, error: error.message });
      failed.push(row.id);
    }
  }
  await logAudit(session, { action: 'product.bulk_price_adjust', entity: 'product', diff: { count: ids.length, ids, percent } });
  revalidatePath('/admin/products');
  if (failed.length > 0) {
    return { error: `Price update failed for ${failed.length} of ${ids.length} product${ids.length !== 1 ? 's' : ''}.` };
  }
  return {};
}
