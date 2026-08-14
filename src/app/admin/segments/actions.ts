'use server';

// Server actions for owner-defined customer segments — the criteria-picker
// counterpart of Shopify's segment editor. Rows live in `customer_segments`
// (RLS, service-role only); membership resolves live through the
// `segment_customers(p_criteria jsonb)` RPC, so a segment never goes stale.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';
import { SEGMENT_BUCKETS, type SegmentCriteria } from '@/lib/segments';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Builds the criteria jsonb from the form, with EXACTLY the keys the RPC
// understands — an empty field is omitted, never written as null/0.
function criteriaFromForm(formData: FormData): { error?: string; criteria?: SegmentCriteria } {
  const criteria: SegmentCriteria = {};

  const readInt = (field: string, label: string): { error?: string; value?: number } => {
    const raw = String(formData.get(field) ?? '').trim();
    if (!raw) return {};
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) return { error: `${label} must be a whole number of 0 or more.` };
    return { value: n };
  };
  const readNum = (field: string, label: string): { error?: string; value?: number } => {
    const raw = String(formData.get(field) ?? '').trim();
    if (!raw) return {};
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return { error: `${label} must be a number of 0 or more.` };
    return { value: n };
  };

  const minOrders = readInt('min_orders', 'Minimum orders');
  if (minOrders.error) return { error: minOrders.error };
  if (minOrders.value != null) criteria.min_orders = minOrders.value;

  const maxOrders = readInt('max_orders', 'Maximum orders');
  if (maxOrders.error) return { error: maxOrders.error };
  if (maxOrders.value != null) criteria.max_orders = maxOrders.value;
  if (criteria.min_orders != null && criteria.max_orders != null && criteria.max_orders < criteria.min_orders) {
    return { error: 'Maximum orders cannot be lower than minimum orders.' };
  }

  const minRevenue = readNum('min_revenue', 'Minimum spent');
  if (minRevenue.error) return { error: minRevenue.error };
  if (minRevenue.value != null) criteria.min_revenue = minRevenue.value;

  const maxRevenue = readNum('max_revenue', 'Maximum spent');
  if (maxRevenue.error) return { error: maxRevenue.error };
  if (maxRevenue.value != null) criteria.max_revenue = maxRevenue.value;
  if (criteria.min_revenue != null && criteria.max_revenue != null && criteria.max_revenue < criteria.min_revenue) {
    return { error: 'Maximum spent cannot be lower than minimum spent.' };
  }

  const within = readInt('ordered_within_days', 'Ordered within days');
  if (within.error) return { error: within.error };
  if (within.value != null) criteria.ordered_within_days = within.value;

  const notWithin = readInt('not_ordered_within_days', 'Has not ordered in days');
  if (notWithin.error) return { error: notWithin.error };
  if (notWithin.value != null) criteria.not_ordered_within_days = notWithin.value;

  const city = String(formData.get('city') ?? '').trim();
  if (city) {
    if (city.length > 120) return { error: 'City is too long.' };
    criteria.city = city;
  }

  const bucket = String(formData.get('bucket') ?? '').trim();
  if (bucket) {
    if (!(SEGMENT_BUCKETS as readonly string[]).includes(bucket)) {
      return { error: 'Pick a valid customer bucket.' };
    }
    criteria.bucket = bucket as SegmentCriteria['bucket'];
  }

  // 'any' (default) omits the key; 'account' / 'guests' write the boolean.
  const hasAccount = String(formData.get('has_account') ?? 'any');
  if (hasAccount === 'account') criteria.has_account = true;
  else if (hasAccount === 'guests') criteria.has_account = false;

  const tagIds = formData.getAll('tag_ids').map(v => String(v).trim()).filter(Boolean);
  if (tagIds.length > 0) {
    for (const id of tagIds) {
      if (!UUID_RE.test(id)) return { error: 'Invalid customer tag selection.' };
    }
    criteria.tag_ids = [...new Set(tagIds)];
  }

  return { criteria };
}

// useActionState shape (same as the coupon create form): errors come back as
// state so the client form keeps its fields; success redirects to the list.
export async function saveSegment(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const session = await assertPermission('customers.edit');

  const id = String(formData.get('id') ?? '').trim() || null;
  if (id && !UUID_RE.test(id)) return { error: 'Bad segment reference.' };

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Give the segment a name.' };
  if (name.length > 120) return { error: 'Name must be 120 characters or fewer.' };

  const built = criteriaFromForm(formData);
  if (built.error) return { error: built.error };
  const criteria = built.criteria!;

  const admin = supabaseAdmin();
  let segmentId: string;
  if (id) {
    const { data, error } = await admin
      .from('customer_segments')
      .update({ name, criteria, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .single();
    if (error || !data) {
      log.error('segment.update_failed', { id, error: error?.message });
      return { error: 'Could not save the segment. It may have been deleted; refresh and try again.' };
    }
    segmentId = data.id as string;
  } else {
    const { data, error } = await admin
      .from('customer_segments')
      .insert({ name, criteria })
      .select('id')
      .single();
    if (error || !data) {
      log.error('segment.create_failed', { name, error: error?.message });
      return { error: 'Could not create the segment. Please try again.' };
    }
    segmentId = data.id as string;
  }

  void logAudit(session, {
    action: id ? 'segment.update' : 'segment.create',
    entity: 'customer_segments',
    entity_id: segmentId,
    diff: { name, criteria },
  });
  revalidatePath('/admin/segments');
  redirect('/admin/segments');
}

/** DeleteButton-shaped delete (id in formData). */
export async function deleteSegment(formData: FormData): Promise<void> {
  const session = await assertPermission('customers.edit');
  const id = String(formData.get('id') ?? '').trim();
  if (!UUID_RE.test(id)) return;

  const admin = supabaseAdmin();
  // Captured first so the audit log keeps the name, not just the uuid.
  const { data: target } = await admin.from('customer_segments').select('name').eq('id', id).maybeSingle();
  const { error } = await admin.from('customer_segments').delete().eq('id', id);
  if (error) {
    log.error('segment.delete_failed', { id, error: error.message });
    return;
  }

  void logAudit(session, {
    action: 'segment.delete',
    entity: 'customer_segments',
    entity_id: id,
    diff: { name: (target as { name: string } | null)?.name ?? null },
  });
  revalidatePath('/admin/segments');
}
