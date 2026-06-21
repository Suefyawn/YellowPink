'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';

async function assertMessages() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('messages'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

function bounce(error: string): never {
  redirect(`/admin/messages?error=${encodeURIComponent(error)}`);
}

type Status = 'new' | 'read' | 'archived';

async function setStatus(formData: FormData, status: Status, action: string): Promise<void> {
  const session = await assertMessages();
  const id = formData.get('id') as string;
  const { error } = await supabaseAdmin()
    .from('contact_messages')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) bounce(`Could not update message: ${error.message}`);
  void logAudit(session, { action, entity: 'contact_messages', entity_id: id });
  revalidatePath('/admin/messages');
}

export async function markMessageRead(formData: FormData): Promise<void> {
  await setStatus(formData, 'read', 'message.read');
}

export async function markMessageUnread(formData: FormData): Promise<void> {
  await setStatus(formData, 'new', 'message.unread');
}

export async function archiveMessage(formData: FormData): Promise<void> {
  await setStatus(formData, 'archived', 'message.archive');
}

export async function restoreMessage(formData: FormData): Promise<void> {
  await setStatus(formData, 'read', 'message.restore');
}

export async function deleteMessage(formData: FormData): Promise<void> {
  const session = await assertMessages();
  const id = formData.get('id') as string;
  const { error } = await supabaseAdmin().from('contact_messages').delete().eq('id', id);
  if (error) bounce(`Could not delete message: ${error.message}`);
  void logAudit(session, { action: 'message.delete', entity: 'contact_messages', entity_id: id });
  revalidatePath('/admin/messages');
}
