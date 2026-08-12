'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { redirect } from 'next/navigation';
import { variantInputSchema, parseForm, firstError } from '@/lib/validators';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';
import { reconcileStock } from '@/lib/stock-writes';

async function assertProducts() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products.edit'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

// ─── Create / update / delete ──────────────────────────────────────────────
export async function createVariant(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await assertProducts();
  const parsed = parseForm(variantInputSchema, formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  // Insert the variant row first, then the option links.
  const { data, error } = await supabaseAdmin()
    .from('product_variants')
    .insert(parsed.data)
    .select('id, product_id')
    .single();
  if (error) return { error: error.message };

  const optionsError = await syncVariantOptions(data.id as string, formData);
  if (optionsError) return { error: optionsError };

  void logAudit(session, {
    action: 'variant.create', entity: 'product_variants', entity_id: data.id as string,
    diff: { product_id: data.product_id, sku: parsed.data.sku, price: parsed.data.price },
  });
  revalidatePath(`/admin/products/${data.product_id as string}`);
  return { success: true };
}

export async function updateVariant(
  variantId: string,
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await assertProducts();
  const parsed = parseForm(variantInputSchema, formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { error } = await supabaseAdmin()
    .from('product_variants')
    .update({
      sku:              parsed.data.sku || null,
      price:            parsed.data.price,
      compare_at_price: parsed.data.compare_at_price ?? null,
      // stock is reconciled through the ledger below, not written here.
      image_url:        parsed.data.image_url || null,
      enabled:          parsed.data.enabled,
      sort_order:       parsed.data.sort_order,
    })
    .eq('id', variantId);
  if (error) return { error: error.message };

  if (typeof parsed.data.stock === 'number') {
    await reconcileStock({
      productId: parsed.data.product_id as string,
      variantId,
      nextStock: parsed.data.stock,
      actor: session,
      note: 'Set on the variant form',
    });
  }

  const optionsError = await syncVariantOptions(variantId, formData);
  if (optionsError) return { error: optionsError };

  void logAudit(session, {
    action: 'variant.update', entity: 'product_variants', entity_id: variantId,
    diff: { product_id: parsed.data.product_id, price: parsed.data.price, stock: parsed.data.stock, enabled: parsed.data.enabled },
  });
  revalidatePath(`/admin/products/${parsed.data.product_id}`);
  return { success: true };
}

export async function deleteVariant(formData: FormData): Promise<void> {
  const session = await assertProducts();
  const id = formData.get('id');
  const productId = formData.get('product_id');
  if (typeof id !== 'string' || typeof productId !== 'string') return;
  const { error } = await supabaseAdmin().from('product_variants').delete().eq('id', id);
  if (error) {
    log.error('variant.delete_failed', { id, error: error.message });
    redirect(`/admin/products/${productId}?error=${encodeURIComponent(`Could not delete variant: ${error.message}`)}`);
  }
  void logAudit(session, {
    action: 'variant.delete', entity: 'product_variants', entity_id: id,
    diff: { product_id: productId },
  });
  revalidatePath(`/admin/products/${productId}`);
}

// ─── Variant attribute links ───────────────────────────────────────────────
// FormData carries one option key per attribute: option__<attribute_id> = <value_id>.
// We wipe the variant_attribute_values for this variant and re-insert.
// Returns an error message (for the caller to surface) or null on success.
async function syncVariantOptions(variantId: string, formData: FormData): Promise<string | null> {
  const optionRows: { variant_id: string; attribute_value_id: string }[] = [];
  for (const [key, val] of formData.entries()) {
    if (!key.startsWith('option__')) continue;
    if (typeof val !== 'string' || !val) continue;
    optionRows.push({ variant_id: variantId, attribute_value_id: val });
  }
  const { error: wipeError } = await supabaseAdmin().from('variant_attribute_values').delete().eq('variant_id', variantId);
  if (wipeError) {
    log.error('variant.options_wipe_failed', { variantId, error: wipeError.message });
    return `Variant saved, but options could not be updated: ${wipeError.message}`;
  }
  if (optionRows.length) {
    const { error: insertError } = await supabaseAdmin().from('variant_attribute_values').insert(optionRows);
    if (insertError) {
      log.error('variant.options_insert_failed', { variantId, error: insertError.message });
      return `Variant saved, but options could not be updated: ${insertError.message}`;
    }
  }
  return null;
}
