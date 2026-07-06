'use server';

// Product gallery management: reorder the images shown on a product page,
// choose which one is the cover (the first / preview image), add more, and
// delete. The first image (sort_order 0) is the PDP hero; we also copy it to
// products.image_url so listing cards, search results and OG previews use the
// same cover. Mirrors the auth + audit + revalidate shape of variant-actions.

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';

async function assertProducts() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products.edit'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

// Bust the admin edit page, the live PDP and the shop listing (the cover feeds
// the card thumbnail), so a reorder/add/delete shows up without a redeploy.
async function revalidateProduct(productId: string) {
  revalidatePath(`/admin/products/${productId}`);
  const { data } = await supabaseAdmin().from('products').select('slug').eq('id', productId).maybeSingle();
  const slug = (data as { slug?: string } | null)?.slug;
  if (slug) revalidatePath(`/product/${slug}`);
  revalidatePath('/shop');
}

/** Persist a new image order. `orderedIds` is the full set of this product's
 *  image ids in the desired order; sort_order is rewritten 0..n and the first
 *  image becomes the product cover (products.image_url). */
export async function saveGalleryOrder(
  productId: string,
  orderedIds: string[],
): Promise<{ error?: string; success?: boolean }> {
  const session = await assertProducts();
  if (!productId || !Array.isArray(orderedIds) || orderedIds.length === 0) return { error: 'Nothing to save.' };
  const admin = supabaseAdmin();

  // Only touch rows that actually belong to this product (guard tampering).
  const { data: rows, error: readErr } = await admin
    .from('product_images').select('id, url').eq('product_id', productId);
  if (readErr) return { error: readErr.message };
  const byId = new Map(((rows ?? []) as Array<{ id: string; url: string }>).map(r => [r.id, r.url]));
  const clean = orderedIds.filter(id => byId.has(id));
  if (clean.length === 0) return { error: 'No matching images.' };

  for (let i = 0; i < clean.length; i++) {
    const { error } = await admin.from('product_images')
      .update({ sort_order: i }).eq('id', clean[i]).eq('product_id', productId);
    if (error) { log.error('gallery.reorder_failed', { productId, error: error.message }); return { error: error.message }; }
  }

  // Cover the product with the new first image so cards/search/OG match the PDP.
  const coverUrl = byId.get(clean[0]);
  if (coverUrl) await admin.from('products').update({ image_url: coverUrl }).eq('id', productId);

  void logAudit(session, {
    action: 'product.gallery_reorder', entity: 'products', entity_id: productId,
    diff: { count: clean.length, cover: coverUrl },
  });
  await revalidateProduct(productId);
  return { success: true };
}

/** Append an already-uploaded image URL to the product's gallery. */
export async function addGalleryImage(
  productId: string,
  url: string,
): Promise<{ error?: string; id?: string }> {
  const session = await assertProducts();
  if (!productId || !url) return { error: 'Missing image.' };
  const admin = supabaseAdmin();

  const { data: maxRow } = await admin.from('product_images')
    .select('sort_order').eq('product_id', productId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const nextSort = (((maxRow as { sort_order?: number } | null)?.sort_order) ?? -1) + 1;

  const { data, error } = await admin.from('product_images')
    .insert({ product_id: productId, url, sort_order: nextSort, variant_id: null })
    .select('id').single();
  if (error) { log.error('gallery.add_failed', { productId, error: error.message }); return { error: error.message }; }

  void logAudit(session, { action: 'product.gallery_add', entity: 'product_images', entity_id: data.id as string, diff: { product_id: productId } });
  await revalidateProduct(productId);
  return { id: data.id as string };
}

/** Remove one gallery image, then renumber the rest and resync the cover. */
export async function deleteGalleryImage(
  imageId: string,
  productId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await assertProducts();
  if (!imageId || !productId) return { error: 'Missing image.' };
  const admin = supabaseAdmin();

  const { error } = await admin.from('product_images').delete().eq('id', imageId).eq('product_id', productId);
  if (error) { log.error('gallery.delete_failed', { imageId, error: error.message }); return { error: error.message }; }

  // Renumber survivors 0..n and resync the product cover to the new first image.
  const { data: rows } = await admin.from('product_images')
    .select('id, url').eq('product_id', productId).order('sort_order');
  const survivors = (rows ?? []) as Array<{ id: string; url: string }>;
  for (let i = 0; i < survivors.length; i++) {
    await admin.from('product_images').update({ sort_order: i }).eq('id', survivors[i].id);
  }
  if (survivors.length) await admin.from('products').update({ image_url: survivors[0].url }).eq('id', productId);

  void logAudit(session, { action: 'product.gallery_delete', entity: 'product_images', entity_id: imageId, diff: { product_id: productId } });
  await revalidateProduct(productId);
  return { success: true };
}
