'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';
import { revalidateStorefrontCatalog } from '@/lib/revalidate-storefront';
import type { Permission } from '@/lib/permissions';
import type { SmartRules } from '@/lib/collections';

// Collections are a merchandising facet of the catalogue → ride the products
// permission set.
async function assertProducts(action: 'edit' | 'view' = 'edit') {
  const session = await getStaffSession();
  const perm: Permission = action === 'view' ? 'products.view' : 'products.edit';
  if (!session || (!session.isOwner && !session.permissions.includes(perm))) {
    throw new Error('Unauthorized');
  }
  return session;
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const str = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();

export async function createCollection(formData: FormData): Promise<void> {
  const session = await assertProducts();
  const title = str(formData, 'title');
  if (!title) redirect('/admin/collections?error=' + encodeURIComponent('Title is required'));
  const slug = slugify(str(formData, 'slug') || title);
  const type = str(formData, 'type') === 'smart' ? 'smart' : 'manual';
  const { data, error } = await supabaseAdmin()
    .from('collections')
    .insert({ title, slug, type, status: 'draft' })
    .select('id')
    .single();
  if (error) {
    log.error('collection.create_failed', { error: error.message });
    redirect('/admin/collections?error=' + encodeURIComponent(error.message));
  }
  await logAudit(session, { action: 'collection.create', entity: 'collection', entity_id: (data as { id: string }).id, diff: { title, slug, type } });
  revalidateStorefrontCatalog();
  redirect(`/admin/collections/${(data as { id: string }).id}`);
}

export async function updateCollection(id: string, formData: FormData): Promise<void> {
  const session = await assertProducts();
  const title = str(formData, 'title');
  const slug = slugify(str(formData, 'slug') || title);
  const status = str(formData, 'status') === 'published' ? 'published' : 'draft';
  const type = str(formData, 'type') === 'smart' ? 'smart' : 'manual';

  // Smart rules arrive as a JSON string from the rule-builder; tolerate empty.
  let rules: SmartRules = {};
  const rawRules = str(formData, 'rules');
  if (rawRules) {
    try { rules = JSON.parse(rawRules) as SmartRules; } catch { rules = {}; }
  }

  const patch = {
    title,
    slug,
    description: str(formData, 'description') || null,
    hero_image_url: str(formData, 'hero_image_url') || null,
    type,
    status,
    rules,
    seo_title: str(formData, 'seo_title') || null,
    seo_description: str(formData, 'seo_description') || null,
    sort_order: Number(str(formData, 'sort_order')) || 0,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin().from('collections').update(patch).eq('id', id);
  if (error) redirect(`/admin/collections/${id}?error=` + encodeURIComponent(error.message));
  await logAudit(session, { action: 'collection.update', entity: 'collection', entity_id: id, diff: patch });
  revalidatePath('/admin/collections');
  revalidatePath(`/admin/collections/${id}`);
  revalidateStorefrontCatalog();
  redirect(`/admin/collections/${id}?saved=1`);
}

export async function deleteCollection(formData: FormData): Promise<void> {
  const session = await assertProducts();
  const id = formData.get('id') as string;
  if (id) {
    const { error } = await supabaseAdmin().from('collections').delete().eq('id', id);
    if (error) {
      // Surface the real DB error instead of showing the "deleted" banner over
      // a delete that never happened.
      log.error('collection.delete_failed', { id, error: error.message });
      redirect('/admin/collections?error=' + encodeURIComponent(`Could not delete collection: ${error.message}`));
    }
    await logAudit(session, { action: 'collection.delete', entity: 'collection', entity_id: id });
  }
  revalidatePath('/admin/collections');
  revalidateStorefrontCatalog();
  redirect('/admin/collections?deleted=1');
}

// Replace a manual collection's product set, ordered by the given id array.
// The delete + re-insert runs inside a single SECURITY DEFINER function
// (migration 20260702_305) so it is atomic: a failed insert can no longer
// leave the DELETE committed and empty the live collection. Either the whole
// new ordered set lands, or the old set is left intact.
export async function setCollectionProducts(collectionId: string, productIds: string[]): Promise<{ error?: string }> {
  const session = await assertProducts();
  const admin = supabaseAdmin();
  const { error } = await admin.rpc('set_collection_products' as never, {
    p_collection_id: collectionId,
    p_product_ids: productIds,
  } as never);
  if (error) return { error: error.message };
  await logAudit(session, { action: 'collection.set_products', entity: 'collection', entity_id: collectionId, diff: { count: productIds.length } });
  revalidatePath(`/admin/collections/${collectionId}`);
  revalidateStorefrontCatalog();
  return {};
}
