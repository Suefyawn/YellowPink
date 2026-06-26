'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';
import type { Permission } from '@/lib/permissions';

async function assertProducts(action: 'edit' | 'delete' = 'edit') {
  const session = await getStaffSession();
  const perm: Permission = action === 'delete' ? 'products.delete' : 'products.edit';
  if (!session || (!session.isOwner && !session.permissions.includes(perm))) {
    throw new Error('Unauthorized');
  }
  return session;
}

// Every write checks its error and returns it to the caller (ProductsTable
// shows a toast) instead of silently revalidating — see issue #191.

// ─── Single-row inline quick edit (price / stock / status) ─────────────────
export async function quickUpdateProduct(
  id: string,
  patch: { price?: number; stock?: number; status?: string },
): Promise<{ error?: string }> {
  const session = await assertProducts();
  const update: Record<string, unknown> = {};
  if (patch.price != null && Number.isFinite(patch.price) && patch.price >= 0) update.price = patch.price;
  if (patch.stock != null && Number.isInteger(patch.stock) && patch.stock >= 0) update.stock = patch.stock;
  if (patch.status && ['published', 'draft', 'archived'].includes(patch.status)) update.status = patch.status;
  if (Object.keys(update).length === 0) return { error: 'Nothing to update' };
  const { error } = await supabaseAdmin().from('products').update(update).eq('id', id);
  if (error) {
    log.error('product.quick_update_failed', { id, error: error.message });
    return { error: error.message };
  }
  await logAudit(session, { action: 'product.quick_update', entity: 'product', entity_id: id, diff: update });
  revalidatePath('/admin/products');
  return {};
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

  // Products with order history are archived, not hard-deleted — see
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
