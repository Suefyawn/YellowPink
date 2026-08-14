'use server';

// Saved views for the Orders list — Shopify's "save this filter combination
// as a tab" (migration 1110, admin_saved_views). A view stores the list's own
// querystring verbatim (minus `page`), so the page stays the single owner of
// what its params mean. Views are shared across staff (Shopify shares them
// per shop, and this team is small), which is why both save and delete gate
// on orders.view: anyone who can work the list can pin — or unpin — a view.

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';

export async function saveOrdersView(formData: FormData): Promise<{ error?: string }> {
  const session = await assertPermission('orders.view');
  const name = String(formData.get('name') ?? '').trim();
  const query = String(formData.get('query') ?? '').trim();
  if (!name || name.length > 60) return { error: 'Enter a name (max 60 characters).' };
  if (!query || query.length > 2000) return { error: 'Apply a filter before saving a view.' };

  const { data: row, error } = await supabaseAdmin()
    .from('admin_saved_views')
    .insert({ surface: 'orders', name, query, created_by: session.email })
    .select('id')
    .single();
  if (error) {
    // 23505: UNIQUE (surface, name) — the team already pinned this name.
    if (error.code === '23505') return { error: 'A view with that name exists.' };
    return { error: error.message };
  }

  await logAudit(session, {
    action: 'orders.view_save', entity: 'admin_saved_view',
    entity_id: (row as { id: string } | null)?.id ?? null,
    diff: { name, query },
  });
  revalidatePath('/admin/orders');
  return {};
}

export async function deleteOrdersView(id: string): Promise<{ error?: string }> {
  const session = await assertPermission('orders.view');
  const admin = supabaseAdmin();

  // Captured first so the audit log keeps the view's name, not just its id.
  const { data: row } = await admin.from('admin_saved_views').select('name, query').eq('id', id).maybeSingle();
  const { error } = await admin.from('admin_saved_views').delete().eq('id', id).eq('surface', 'orders');
  if (error) return { error: error.message };

  await logAudit(session, {
    action: 'orders.view_delete', entity: 'admin_saved_view', entity_id: id,
    diff: { name: (row as { name: string; query: string } | null)?.name ?? id },
  });
  revalidatePath('/admin/orders');
  return {};
}
