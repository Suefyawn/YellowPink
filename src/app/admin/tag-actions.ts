'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';
import type { Permission } from '@/lib/permissions';

// Feedback carriers for the /admin/tags forms (were silent). Call outside
// try/catch — redirect() throws a control-flow signal.
const tagOk = (msg: string): never => redirect(`/admin/tags?saved=${encodeURIComponent(msg)}`);
const tagFail = (msg: string): never => redirect(`/admin/tags?error=${encodeURIComponent(msg)}`);

// Product tags are a facet of the catalogue, so they ride the products
// permission set rather than introducing a new one.
async function assertProducts(action: 'edit' | 'view' = 'edit') {
  const session = await getStaffSession();
  const perm: Permission = action === 'view' ? 'products.view' : 'products.edit';
  if (!session || (!session.isOwner && !session.permissions.includes(perm))) {
    throw new Error('Unauthorized');
  }
  return session;
}

/** URL-safe slug for a tag name. "Fragrance Free!" → "fragrance-free". */
function slugifyTag(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ─── Per-product tag assignment (free-type + reuse) ────────────────────────
// Replaces a product's full tag set. Any name without an existing tag is
// created on the fly (deduplicated by slug), so the editor never needs a
// separate "create tag" step, exactly like WooCommerce / Shopify tagging.
export async function setProductTags(productId: string, names: string[]): Promise<{ error?: string }> {
  const session = await assertProducts();
  const admin = supabaseAdmin();

  // Normalise + dedupe by slug, keeping the first display spelling seen.
  const wanted = new Map<string, string>(); // slug → display name
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const slug = slugifyTag(name);
    if (slug && !wanted.has(slug)) wanted.set(slug, name);
  }
  const slugs = [...wanted.keys()];

  const tagIdBySlug = new Map<string, string>();
  if (slugs.length > 0) {
    // Create any missing tags. ignoreDuplicates so re-using an existing tag is
    // a no-op rather than an error.
    const { error: upErr } = await admin
      .from('product_tags')
      .upsert(slugs.map(slug => ({ slug, name: wanted.get(slug)! })), { onConflict: 'slug', ignoreDuplicates: true });
    if (upErr) { log.error('tag.upsert_failed', { error: upErr.message }); return { error: upErr.message }; }

    const { data: tagRows, error: selErr } = await admin.from('product_tags').select('id, slug').in('slug', slugs);
    if (selErr) return { error: selErr.message };
    for (const t of (tagRows ?? []) as Array<{ id: string; slug: string }>) tagIdBySlug.set(t.slug, t.id);
  }

  // Replace the join rows: clear then insert the wanted set.
  const { error: delErr } = await admin.from('product_tag_map').delete().eq('product_id', productId);
  if (delErr) return { error: delErr.message };
  const mapRows = slugs
    .map(slug => ({ product_id: productId, tag_id: tagIdBySlug.get(slug)! }))
    .filter(r => r.tag_id);
  if (mapRows.length > 0) {
    const { error: insErr } = await admin.from('product_tag_map').insert(mapRows);
    if (insErr) return { error: insErr.message };
  }

  await logAudit(session, { action: 'product.set_tags', entity: 'product', entity_id: productId, diff: { tags: [...wanted.values()] } });
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath('/admin/products');
  return {};
}

// ─── Tags manager (create / rename / delete) ───────────────────────────────
export async function createTag(formData: FormData): Promise<void> {
  const session = await assertProducts();
  const name = ((formData.get('name') as string) ?? '').trim();
  const slug = slugifyTag(name);
  if (!name || !slug) tagFail('Enter a tag name.');
  const { error } = await supabaseAdmin()
    .from('product_tags')
    .upsert({ slug, name }, { onConflict: 'slug', ignoreDuplicates: true });
  if (error) tagFail(`Could not create tag: ${error.message}`);
  await logAudit(session, { action: 'tag.create', entity: 'product_tag', diff: { slug, name } });
  revalidatePath('/admin/tags');
  tagOk(`Tag “${name}” created.`);
}

// Renaming keeps the slug stable so any `?tag=<slug>` storefront links and
// bookmarks survive a display-name tweak.
export async function renameTag(formData: FormData): Promise<void> {
  const session = await assertProducts();
  const id = formData.get('id') as string;
  const name = ((formData.get('name') as string) ?? '').trim();
  if (!id || !name) tagFail('Enter a new name.');
  const { error } = await supabaseAdmin().from('product_tags').update({ name }).eq('id', id);
  if (error) tagFail(`Could not rename tag: ${error.message}`);
  await logAudit(session, { action: 'tag.rename', entity: 'product_tag', entity_id: id, diff: { name } });
  revalidatePath('/admin/tags');
  tagOk(`Tag renamed to “${name}”.`);
}

// Deleting a tag cascades through product_tag_map (FK on delete cascade), so
// it's removed from every product automatically.
export async function deleteTag(formData: FormData): Promise<void> {
  const session = await assertProducts();
  const id = formData.get('id') as string;
  if (!id) tagFail('Missing tag id.');
  const { error } = await supabaseAdmin().from('product_tags').delete().eq('id', id);
  if (error) tagFail(`Could not delete tag: ${error.message}`);
  await logAudit(session, { action: 'tag.delete', entity: 'product_tag', entity_id: id });
  revalidatePath('/admin/tags');
  tagOk('Tag deleted.');
}
