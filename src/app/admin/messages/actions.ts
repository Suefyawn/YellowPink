'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin, getSiteSettings } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { sendCustomerReplyEmail } from '@/lib/email';

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

// ─── Threaded conversations ──────────────────────────────────────────────
// Reply to a customer from the inbox: email the reply via Resend (from the
// store support address) and record it as an outbound message in the same
// thread (grouped by customer email). The customer's reply returns to the
// inbound webhook and threads back automatically.
export async function sendReply(formData: FormData): Promise<void> {
  const session = await assertMessages();
  const email = ((formData.get('email') as string) || '').trim().toLowerCase();
  const name = ((formData.get('name') as string) || '').trim();
  const rawSubject = ((formData.get('subject') as string) || '').trim();
  const body = ((formData.get('body') as string) || '').trim();
  if (!email || !body) bounce('A reply needs a recipient and a message.');

  const settings = await getSiteSettings();
  const support = (settings.store_email || '').trim() || 'hello@yellowpink.pk';
  // Only override the verified default `from` when the support address is on
  // the verified domain; otherwise Resend would reject the send.
  const from = /@yellowpink\.pk$/i.test(support) ? `Yellow Pink <${support}>` : undefined;
  const subject = rawSubject
    ? (/^re:/i.test(rawSubject) ? rawSubject : `Re: ${rawSubject}`)
    : 'Re: your message to Yellow Pink';

  const sent = await sendCustomerReplyEmail({ to: email, customerName: name, subject, body, from, replyTo: support });
  if (!sent) bounce('Reply could not be sent — check the email (Resend) configuration.');

  const admin = supabaseAdmin();
  const { error } = await admin.from('contact_messages').insert({
    name: 'Yellow Pink', email, subject, message: body,
    source: 'admin_reply', direction: 'outbound', status: 'read',
  });
  if (error) bounce(`Reply sent but could not be recorded: ${error.message}`);
  // Mark the customer's unread inbound messages in this thread as read.
  await admin.from('contact_messages')
    .update({ status: 'read', updated_at: new Date().toISOString() })
    .eq('email', email).eq('direction', 'inbound').eq('status', 'new');
  void logAudit(session, { action: 'message.reply', entity: 'contact_messages' });
  revalidatePath('/admin/messages');
}

// Thread-level status changes (keyed by the customer email). mark-read only
// touches unread inbound rows; archive/restore move the whole conversation.
async function threadStatus(formData: FormData, status: Status, action: string, inboundNewOnly: boolean): Promise<void> {
  const session = await assertMessages();
  const email = ((formData.get('email') as string) || '').trim().toLowerCase();
  if (!email) bounce('Missing conversation.');
  let q = supabaseAdmin().from('contact_messages')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('email', email);
  if (inboundNewOnly) q = q.eq('direction', 'inbound').eq('status', 'new');
  const { error } = await q;
  if (error) bounce(`Could not update conversation: ${error.message}`);
  void logAudit(session, { action, entity: 'contact_messages' });
  revalidatePath('/admin/messages');
}

export async function markThreadRead(formData: FormData): Promise<void> {
  await threadStatus(formData, 'read', 'thread.read', true);
}
export async function archiveThread(formData: FormData): Promise<void> {
  await threadStatus(formData, 'archived', 'thread.archive', false);
}
export async function restoreThread(formData: FormData): Promise<void> {
  await threadStatus(formData, 'read', 'thread.restore', false);
}
