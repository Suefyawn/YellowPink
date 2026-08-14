'use server';

// Customer tags from the admin customer page — Shopify's free-form customer
// labels (vip, prepay-only, influencer…) for filtering and outreach. A
// reusable registry (customer_tags) plus a join keyed by cust_key: the same
// identifier the customer page's URL uses (registered auth uuid, or the
// guest-<base64url> id synthesised from their email/phone), so guests are
// first-class. Each add/remove saves immediately.

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';

/** URL-safe slug for a tag name. "Prepay Only!" → "prepay-only". */
function slugifyTag(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function addCustomerTag(custKey: string, formData: FormData): Promise<{ error?: string }> {
  const session = await assertPermission('customers.edit');
  const key = custKey.trim();
  if (!key || key.length > 300) return { error: 'Bad customer reference.' };
  const name = String(formData.get('name') ?? '').trim();
  const slug = slugifyTag(name);
  if (!name || !slug) return { error: 'Enter a tag name.' };

  const admin = supabaseAdmin();
  // Find-or-create in the registry. ignoreDuplicates so re-using an existing
  // tag keeps its original display spelling and is a no-op, not an error.
  const { error: upErr } = await admin
    .from('customer_tags')
    .upsert({ slug, name }, { onConflict: 'slug', ignoreDuplicates: true });
  if (upErr) return { error: upErr.message };
  const { data: tagRow, error: selErr } = await admin.from('customer_tags').select('id, name').eq('slug', slug).single();
  if (selErr || !tagRow) return { error: selErr?.message ?? 'Tag lookup failed.' };
  const tag = tagRow as { id: string; name: string };

  // Upsert the join row so tagging twice is a no-op.
  const { error: mapErr } = await admin
    .from('customer_tag_map')
    .upsert({ cust_key: key, tag_id: tag.id }, { onConflict: 'cust_key,tag_id', ignoreDuplicates: true });
  if (mapErr) return { error: mapErr.message };

  await logAudit(session, { action: 'customer.tag_add', entity: 'customer', entity_id: key, diff: { tag: tag.name, slug } });
  revalidatePath(`/admin/users/${key}`);
  revalidatePath('/admin/users');
  return {};
}

export async function removeCustomerTag(custKey: string, tagId: string): Promise<{ error?: string }> {
  const session = await assertPermission('customers.edit');
  const admin = supabaseAdmin();

  // Captured first so the audit log keeps the tag's name, not just its id.
  const { data: tagRow } = await admin.from('customer_tags').select('name').eq('id', tagId).maybeSingle();
  const { error } = await admin.from('customer_tag_map').delete().eq('cust_key', custKey).eq('tag_id', tagId);
  if (error) return { error: error.message };

  await logAudit(session, {
    action: 'customer.tag_remove', entity: 'customer', entity_id: custKey,
    diff: { tag: (tagRow as { name: string } | null)?.name ?? tagId },
  });
  revalidatePath(`/admin/users/${custKey}`);
  revalidatePath('/admin/users');
  return {};
}
