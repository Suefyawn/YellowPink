'use server';

// Order tags from the admin order page — Shopify's free-form order labels
// (rush, exchange, wholesale…) for triage and filtering. A reusable registry
// (order_tags) plus a join (order_tag_map), mirroring product tags, but
// unlike setProductTags these persist per add/remove: each chip the operator
// adds or removes on the order page saves immediately.

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';

/** URL-safe slug for a tag name. "Rush Order!" → "rush-order". */
function slugifyTag(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function addOrderTag(orderId: string, formData: FormData): Promise<{ error?: string }> {
  const session = await assertPermission('orders.edit');
  const name = String(formData.get('name') ?? '').trim();
  const slug = slugifyTag(name);
  if (!name || !slug) return { error: 'Enter a tag name.' };

  const admin = supabaseAdmin();
  // Find-or-create in the registry. ignoreDuplicates so re-using an existing
  // tag keeps its original display spelling and is a no-op, not an error.
  const { error: upErr } = await admin
    .from('order_tags')
    .upsert({ slug, name }, { onConflict: 'slug', ignoreDuplicates: true });
  if (upErr) return { error: upErr.message };
  const { data: tagRow, error: selErr } = await admin.from('order_tags').select('id, name').eq('slug', slug).single();
  if (selErr || !tagRow) return { error: selErr?.message ?? 'Tag lookup failed.' };
  const tag = tagRow as { id: string; name: string };

  // Upsert the join row so tagging twice is a no-op.
  const { error: mapErr } = await admin
    .from('order_tag_map')
    .upsert({ order_id: orderId, tag_id: tag.id }, { onConflict: 'order_id,tag_id', ignoreDuplicates: true });
  if (mapErr) return { error: mapErr.message };

  await logAudit(session, { action: 'order.tag_add', entity: 'order', entity_id: orderId, diff: { tag: tag.name, slug } });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/orders');
  return {};
}

export async function removeOrderTag(orderId: string, tagId: string): Promise<{ error?: string }> {
  const session = await assertPermission('orders.edit');
  const admin = supabaseAdmin();

  // Captured first so the audit log keeps the tag's name, not just its id.
  const { data: tagRow } = await admin.from('order_tags').select('name').eq('id', tagId).maybeSingle();
  const { error } = await admin.from('order_tag_map').delete().eq('order_id', orderId).eq('tag_id', tagId);
  if (error) return { error: error.message };

  await logAudit(session, {
    action: 'order.tag_remove', entity: 'order', entity_id: orderId,
    diff: { tag: (tagRow as { name: string } | null)?.name ?? tagId },
  });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/orders');
  return {};
}
