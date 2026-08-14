'use server';

// Customer notes from the admin customer page — append-only, authored facts
// about a customer ("always call before 6pm", "prefers bank transfer"),
// Shopify's customer-page note done as a proper list instead of one
// overwritable box. Keyed by cust_key: the same identifier the customer
// page's URL uses (registered auth uuid, or the guest-<base64url> id
// synthesised from their email/phone), so guests are first-class.

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';

export async function addCustomerNote(custKey: string, formData: FormData): Promise<void> {
  const session = await assertPermission('customers.edit');

  const key = custKey.trim();
  if (!key || key.length > 300) throw new Error('Bad customer reference');
  const body = String(formData.get('body') ?? '').trim().slice(0, 2000);
  if (!body) throw new Error('Write the note first');

  const { data, error } = await supabaseAdmin()
    .from('customer_notes')
    .insert({ cust_key: key, author: session.email || 'staff', body })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  void logAudit(session, {
    action: 'customer.note_added', entity: 'customer_notes', entity_id: (data as { id: string }).id,
    diff: { cust_key: key, body },
  });
  revalidatePath(`/admin/users/${key}`);
}

export async function deleteCustomerNote(id: string, custKey: string): Promise<void> {
  const session = await assertPermission('customers.edit');

  // Scoped to the customer so a forged id can't delete another customer's
  // note, and captured first so the audit log keeps what was removed.
  const { data: existing } = await supabaseAdmin()
    .from('customer_notes')
    .select('id, author, body, created_at')
    .eq('id', id)
    .eq('cust_key', custKey)
    .maybeSingle();
  if (!existing) throw new Error('Note not found');

  const { error } = await supabaseAdmin().from('customer_notes').delete().eq('id', id);
  if (error) throw new Error(error.message);

  void logAudit(session, {
    action: 'customer.note_deleted', entity: 'customer_notes', entity_id: id,
    diff: { cust_key: custKey, ...(existing as Record<string, unknown>) },
  });
  revalidatePath(`/admin/users/${custKey}`);
}
