'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { variantInputSchema, parseForm, firstError } from '@/lib/validators';

async function assertProducts(): Promise<void> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products'))) {
    throw new Error('Unauthorized');
  }
}

// ─── Create / update / delete ──────────────────────────────────────────────
export async function createVariant(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  await assertProducts();
  const parsed = parseForm(variantInputSchema, formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  // Insert the variant row first, then the option links.
  const { data, error } = await supabase
    .from('product_variants')
    .insert(parsed.data)
    .select('id, product_id')
    .single();
  if (error) return { error: error.message };

  await syncVariantOptions(data.id as string, formData);

  revalidatePath(`/admin/products/${data.product_id as string}`);
  return { success: true };
}

export async function updateVariant(
  variantId: string,
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  await assertProducts();
  const parsed = parseForm(variantInputSchema, formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { error } = await supabase
    .from('product_variants')
    .update({
      sku:              parsed.data.sku || null,
      price:            parsed.data.price,
      compare_at_price: parsed.data.compare_at_price ?? null,
      stock:            parsed.data.stock,
      image_url:        parsed.data.image_url || null,
      enabled:          parsed.data.enabled,
      sort_order:       parsed.data.sort_order,
    })
    .eq('id', variantId);
  if (error) return { error: error.message };

  await syncVariantOptions(variantId, formData);

  revalidatePath(`/admin/products/${parsed.data.product_id}`);
  return { success: true };
}

export async function deleteVariant(formData: FormData): Promise<void> {
  await assertProducts();
  const id = formData.get('id');
  const productId = formData.get('product_id');
  if (typeof id !== 'string' || typeof productId !== 'string') return;
  await supabase.from('product_variants').delete().eq('id', id);
  revalidatePath(`/admin/products/${productId}`);
}

// ─── Variant attribute links ───────────────────────────────────────────────
// FormData carries one option key per attribute: option__<attribute_id> = <value_id>.
// We wipe the variant_attribute_values for this variant and re-insert.
async function syncVariantOptions(variantId: string, formData: FormData): Promise<void> {
  const optionRows: { variant_id: string; attribute_value_id: string }[] = [];
  for (const [key, val] of formData.entries()) {
    if (!key.startsWith('option__')) continue;
    if (typeof val !== 'string' || !val) continue;
    optionRows.push({ variant_id: variantId, attribute_value_id: val });
  }
  await supabase.from('variant_attribute_values').delete().eq('variant_id', variantId);
  if (optionRows.length) {
    await supabase.from('variant_attribute_values').insert(optionRows);
  }
}
