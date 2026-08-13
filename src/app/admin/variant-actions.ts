'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { redirect } from 'next/navigation';
import { variantInputSchema, parseForm, firstError } from '@/lib/validators';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';
import { reconcileStock } from '@/lib/stock-writes';
import { toSlug } from '@/lib/product-csv';

async function assertProducts() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products.edit'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

// ─── Attributes & values ────────────────────────────────────────────────────
// A new shade used to be unreachable from the admin: the variant form only
// offered EXISTING attribute values, and the empty state told the owner to
// insert rows by SQL. These two actions close that gap from the product page.

/** Add a value (a new shade, size, form…) to an existing attribute. */
export async function createAttributeValue(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await assertProducts();
  const attributeId = String(formData.get('attribute_id') ?? '');
  const value = String(formData.get('value') ?? '').trim().slice(0, 120);
  const productId = String(formData.get('product_id') ?? '');
  if (!attributeId || !value) return { error: 'Type the new value first.' };

  const slug = toSlug(value);
  if (!slug) return { error: 'That value has no usable characters.' };

  const admin = supabaseAdmin();
  // Same value twice under one attribute would create two indistinguishable
  // dropdown entries; surface the existing one instead.
  const { data: dupe } = await admin
    .from('attribute_values')
    .select('id')
    .eq('attribute_id', attributeId)
    .eq('slug', slug)
    .maybeSingle();
  if (dupe) return { error: `"${value}" already exists for this attribute — pick it from the dropdown.` };

  const { data: last } = await admin
    .from('attribute_values')
    .select('sort_order')
    .eq('attribute_id', attributeId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1;

  const { data, error } = await admin
    .from('attribute_values')
    .insert({ attribute_id: attributeId, slug, value, sort_order: sortOrder })
    .select('id')
    .single();
  if (error) return { error: error.message };

  void logAudit(session, {
    action: 'attribute_value.create', entity: 'attribute_values', entity_id: (data as { id: string }).id,
    diff: { attribute_id: attributeId, value, slug },
  });

  // Shopify-style shortcut: adding a shade usually means "this product now
  // comes in that shade", so optionally create its variant in the same click —
  // at the product's own price, zero stock, ready to edit below.
  if (productId && formData.get('create_variant') === 'true') {
    const { data: prod } = await admin
      .from('products')
      .select('price')
      .eq('id', productId)
      .maybeSingle();
    const { data: lastVar } = await admin
      .from('product_variants')
      .select('sort_order')
      .eq('product_id', productId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: variant, error: varErr } = await admin
      .from('product_variants')
      .insert({
        product_id: productId,
        price: (prod as { price: number } | null)?.price ?? 0,
        stock: 0,
        enabled: true,
        sort_order: ((lastVar as { sort_order: number } | null)?.sort_order ?? 0) + 1,
      })
      .select('id')
      .single();
    if (varErr) return { error: `Value added, but its variant failed: ${varErr.message}` };
    const { error: linkErr } = await admin
      .from('variant_attribute_values')
      .insert({ variant_id: (variant as { id: string }).id, attribute_value_id: (data as { id: string }).id });
    if (linkErr) return { error: `Value and variant added, but linking failed: ${linkErr.message}` };
  }

  if (productId) revalidatePath(`/admin/products/${productId}`);
  return { success: true };
}

/**
 * Remove a value from THIS product, Shopify-style: delete the product's
 * variants carrying it. Refuses while any of those variants still holds
 * stock, so goods can't disappear from the books via a chip's ×. If the value
 * is used by nothing anywhere afterwards, the registry entry is tidied away
 * too; if another product still uses it, the value itself survives.
 */
export async function removeValueFromProduct(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await assertProducts();
  const valueId = String(formData.get('value_id') ?? '');
  const productId = String(formData.get('product_id') ?? '');
  if (!valueId || !productId) return { error: 'Missing value or product.' };

  const admin = supabaseAdmin();
  const { data: links } = await admin
    .from('variant_attribute_values')
    .select('variant_id')
    .eq('attribute_value_id', valueId);
  const linkedIds = ((links ?? []) as Array<{ variant_id: string }>).map(l => l.variant_id);

  let doomed: Array<{ id: string; stock: number | null }> = [];
  if (linkedIds.length) {
    const { data: variants } = await admin
      .from('product_variants')
      .select('id, stock')
      .eq('product_id', productId)
      .in('id', linkedIds);
    doomed = (variants ?? []) as Array<{ id: string; stock: number | null }>;
  }

  const stocked = doomed.filter(v => (v.stock ?? 0) > 0);
  if (stocked.length) {
    return { error: `That value's variant still holds ${stocked.reduce((n, v) => n + (v.stock ?? 0), 0)} unit(s). Zero the stock first (edit the variant or log it in Inventory), then remove it.` };
  }

  if (doomed.length) {
    const { error } = await admin
      .from('product_variants')
      .delete()
      .in('id', doomed.map(v => v.id));
    if (error) return { error: `Could not remove: ${error.message}` };
  }

  // Registry hygiene: a value no variant anywhere uses any more disappears
  // from the dropdowns too, so the list stays what's real.
  const { data: remaining } = await admin
    .from('variant_attribute_values')
    .select('variant_id')
    .eq('attribute_value_id', valueId)
    .limit(1);
  if (!remaining || remaining.length === 0) {
    await admin.from('attribute_values').delete().eq('id', valueId);
  }

  void logAudit(session, {
    action: 'attribute_value.remove_from_product', entity: 'attribute_values', entity_id: valueId,
    diff: { product_id: productId, variants_deleted: doomed.length, registry_deleted: !remaining || remaining.length === 0 },
  });
  revalidatePath(`/admin/products/${productId}`);
  return { success: true };
}

/** Create a new attribute (Shade, Size, Form…) with its first value, for
 *  products whose variants need an axis that doesn't exist yet. */
export async function createAttribute(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await assertProducts();
  const name = String(formData.get('name') ?? '').trim().slice(0, 80);
  const firstValue = String(formData.get('first_value') ?? '').trim().slice(0, 120);
  const productId = String(formData.get('product_id') ?? '');
  if (!name || !firstValue) return { error: 'Give the attribute a name and its first value.' };

  const slug = toSlug(name);
  if (!slug) return { error: 'That name has no usable characters.' };

  const admin = supabaseAdmin();
  const { data: dupe } = await admin
    .from('product_attributes')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (dupe) return { error: `An attribute called "${name}" already exists.` };

  const { data: last } = await admin
    .from('product_attributes')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1;

  const { data: attr, error } = await admin
    .from('product_attributes')
    .insert({ slug, name, visible_on_pdp: true, usable_in_filter: false, sort_order: sortOrder })
    .select('id')
    .single();
  if (error) return { error: error.message };
  const attributeId = (attr as { id: string }).id;

  const { error: valErr } = await admin
    .from('attribute_values')
    .insert({ attribute_id: attributeId, slug: toSlug(firstValue), value: firstValue, sort_order: 1 });
  if (valErr) return { error: `Attribute created, but its first value failed: ${valErr.message}` };

  void logAudit(session, {
    action: 'attribute.create', entity: 'product_attributes', entity_id: attributeId,
    diff: { name, slug, first_value: firstValue },
  });
  if (productId) revalidatePath(`/admin/products/${productId}`);
  return { success: true };
}

/** Does this product's stock get counted at all? Vendor-held ('external') and
 *  deliberately uncounted ('untracked') products answer no — their variants
 *  carry no meaningful count either, so variant stock writes are skipped. */
async function productStockCounted(productId: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from('products')
    .select('stock_mode, track_inventory')
    .eq('id', productId)
    .maybeSingle();
  const p = data as { stock_mode?: string | null; track_inventory?: boolean | null } | null;
  if (!p) return true; // unknown product: let the FK insert fail with its own error
  return (p.stock_mode ?? (p.track_inventory === false ? 'untracked' : 'own')) === 'own';
}

// ─── Create / update / delete ──────────────────────────────────────────────
export async function createVariant(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await assertProducts();
  const parsed = parseForm(variantInputSchema, formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  // A vendor-held or uncounted product's shades have nothing to count: start
  // them at zero regardless of what a stale or hand-built form submitted. The
  // form hides the input for these products; this is the server's own line.
  if (!(await productStockCounted(parsed.data.product_id as string))) {
    parsed.data.stock = 0;
  }

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

  // Only stock we hold is reconcilable. For a vendor-held or uncounted
  // product the shades carry no count either, so a submitted number (stale
  // tab, hand-built request) must not mint ledger rows.
  if (typeof parsed.data.stock === 'number' && await productStockCounted(parsed.data.product_id as string)) {
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
