'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';

// Bundle composition rides the products permission set — it's catalogue data.
async function assertProductsEdit() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products.edit'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

const fail = (bundleId: string, msg: string): never =>
  redirect(`/admin/products/${bundleId}?error=${encodeURIComponent(msg)}`);

/** Revalidate both surfaces that render from bundle_components: the admin
 *  pricing panel and the storefront PDP "What's inside" section. */
async function revalidateBundle(bundleId: string) {
  revalidatePath(`/admin/products/${bundleId}`);
  const { data } = await supabaseAdmin().from('products').select('slug').eq('id', bundleId).single();
  const slug = (data as { slug?: string } | null)?.slug;
  if (slug) revalidatePath(`/product/${slug}`);
}

/** Add a component to a bundle, or update its quantity if already present. */
export async function addBundleComponent(formData: FormData): Promise<void> {
  const session = await assertProductsEdit();
  const bundleId = (formData.get('bundle_id') as string) ?? '';
  const componentId = (formData.get('component_id') as string) ?? '';
  const qty = Math.floor(Number(formData.get('qty') ?? 1));

  if (!bundleId || !componentId) fail(bundleId || 'unknown', 'Pick a product to add.');
  if (bundleId === componentId) fail(bundleId, 'A set can’t contain itself.');
  if (!Number.isFinite(qty) || qty < 1 || qty > 20) fail(bundleId, 'Quantity must be between 1 and 20.');

  const admin = supabaseAdmin();
  // Append after the current last row so display order is stable.
  const { data: existing } = await admin
    .from('bundle_components')
    .select('sort_order')
    .eq('bundle_product_id', bundleId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextSort = ((existing?.[0] as { sort_order?: number } | undefined)?.sort_order ?? -1) + 1;

  const { error } = await admin
    .from('bundle_components')
    .upsert(
      { bundle_product_id: bundleId, component_product_id: componentId, qty, sort_order: nextSort },
      { onConflict: 'bundle_product_id,component_product_id' },
    );
  if (error) {
    log.error('bundle.add_component_failed', { bundleId, componentId, error: error.message });
    fail(bundleId, `Could not add component: ${error.message}`);
  }

  await logAudit(session, {
    action: 'product.bundle_add_component',
    entity: 'product',
    entity_id: bundleId,
    diff: { component_product_id: componentId, qty },
  });
  await revalidateBundle(bundleId);
}

/** Remove a component from a bundle. */
export async function removeBundleComponent(formData: FormData): Promise<void> {
  const session = await assertProductsEdit();
  const bundleId = (formData.get('bundle_id') as string) ?? '';
  const componentId = (formData.get('component_id') as string) ?? '';
  if (!bundleId || !componentId) fail(bundleId || 'unknown', 'Missing component.');

  const { error } = await supabaseAdmin()
    .from('bundle_components')
    .delete()
    .eq('bundle_product_id', bundleId)
    .eq('component_product_id', componentId);
  if (error) {
    log.error('bundle.remove_component_failed', { bundleId, componentId, error: error.message });
    fail(bundleId, `Could not remove component: ${error.message}`);
  }

  await logAudit(session, {
    action: 'product.bundle_remove_component',
    entity: 'product',
    entity_id: bundleId,
    diff: { component_product_id: componentId },
  });
  await revalidateBundle(bundleId);
}
