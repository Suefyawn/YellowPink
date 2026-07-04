'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { boolField } from '@/lib/validators';
import type { NotificationEvent } from '@/lib/notification-recipients';

const VALID_EVENTS: NotificationEvent[] = ['order.new', 'seo.broken_links'];
const PATH = '/admin/settings/notifications';

// Gated like the rest of the settings surface (matches push-actions.ts): the
// 'settings' permission covers notification management, so recipient actions
// must accept it, not just the owner.
async function assertSettings() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

function err(message: string): never {
  redirect(`${PATH}?error=${encodeURIComponent(message)}`);
}

function ok(): never {
  revalidatePath(PATH);
  redirect(`${PATH}?saved=1`);
}

function parseEmail(formData: FormData): string {
  const raw = (formData.get('email') as string | null)?.trim().toLowerCase() ?? '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)) err('Please enter a valid email address.');
  return raw;
}

function parseEvents(formData: FormData): NotificationEvent[] {
  const picked = formData.getAll('events').map(v => String(v)) as NotificationEvent[];
  const validated = picked.filter(e => VALID_EVENTS.includes(e));
  if (validated.length === 0) err('Pick at least one event for this recipient.');
  return validated;
}

export async function addRecipient(formData: FormData): Promise<void> {
  const session = await assertSettings();
  const email = parseEmail(formData);
  const events = parseEvents(formData);

  // .select('id').single() so the audit row can carry entity_id, without it
  // an audit reader has to grep diff.email to find which recipient was added.
  const { data: created, error } = await supabaseAdmin()
    .from('notification_recipients')
    .insert({ email, events, enabled: true })
    .select('id')
    .single();

  if (error) {
    // 23505 = unique_violation on the email constraint.
    if (error.code === '23505') err(`${email} is already on the list, edit it instead.`);
    err(error.message);
  }

  void logAudit(session, {
    action: 'notification_recipient.create',
    entity: 'notification_recipients',
    entity_id: created?.id ?? null,
    diff: { email, events },
  });
  ok();
}

export async function updateRecipient(id: string, formData: FormData): Promise<void> {
  const session = await assertSettings();
  const events = parseEvents(formData);
  // The Active/Paused toggle submits a hidden 'false' before the checkbox
  // 'true'; boolField lets the checkbox (last value) win so a recipient can be
  // re-enabled — formData.get() would always read the leading 'false'.
  const enabled = boolField(formData, 'enabled');

  const { error } = await supabaseAdmin()
    .from('notification_recipients')
    .update({ events, enabled })
    .eq('id', id);

  if (error) err(error.message);

  void logAudit(session, {
    action: 'notification_recipient.update',
    entity: 'notification_recipients',
    entity_id: id,
    diff: { events, enabled },
  });
  ok();
}

export async function deleteRecipient(formData: FormData): Promise<void> {
  const session = await assertSettings();
  const id = formData.get('id') as string;
  if (!id) err('Missing recipient id.');

  // .select('email').single() so the audit row records WHICH email was
  // deleted, not just the (now-gone) row id. After delete the row is gone, so
  // the only chance to capture the email is to ask Supabase to return the
  // deleted row in the same statement.
  const { data: deleted, error } = await supabaseAdmin()
    .from('notification_recipients')
    .delete()
    .eq('id', id)
    .select('email')
    .single();

  if (error) err(error.message);

  void logAudit(session, {
    action: 'notification_recipient.delete',
    entity: 'notification_recipients',
    entity_id: id,
    diff: { email: deleted?.email ?? null },
  });
  ok();
}
