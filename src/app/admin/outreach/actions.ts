'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { can } from '@/lib/permissions';
import { sendOutreachEmail } from '@/lib/email';
import { log } from '@/lib/logger';

// Admin → Outreach. Every action re-checks the session server-side; the page
// gate alone is not a security boundary.

const PAGE = '/admin/outreach';

async function requireOutreach() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !can(session, 'outreach'))) {
    redirect(PAGE);
  }
  return session!;
}

function back(prospectId: string | null, param: 'ok' | 'error', msg: string): never {
  const p = new URLSearchParams();
  if (prospectId) p.set('prospect', prospectId);
  p.set(param, msg);
  redirect(`${PAGE}?${p.toString()}`);
}

/** Edit a pitch while it is still a draft. Subject and body only — the send
 *  itself is a separate, deliberate click. */
export async function saveDraft(formData: FormData): Promise<void> {
  await requireOutreach();
  const id = String(formData.get('message_id') ?? '');
  const prospectId = String(formData.get('prospect_id') ?? '') || null;
  const subject = String(formData.get('subject') ?? '').trim().slice(0, 200);
  const body = String(formData.get('body') ?? '').trim().slice(0, 8000);
  if (!id || !body) back(prospectId, 'error', 'The message body cannot be empty.');

  const { error } = await supabaseAdmin()
    .from('outreach_messages')
    .update({ subject: subject || null, body })
    .eq('id', id)
    .eq('status', 'draft');
  if (error) back(prospectId, 'error', 'Could not save the draft.');
  revalidatePath(PAGE);
  back(prospectId, 'ok', 'Draft saved.');
}

/** Fix a prospect's contact address or notes (the research is good but not
 *  infallible, and some prospects were found without a published email). */
export async function updateProspect(formData: FormData): Promise<void> {
  await requireOutreach();
  const id = String(formData.get('prospect_id') ?? '');
  if (!id) back(null, 'error', 'Missing prospect.');
  const email = String(formData.get('contact_email') ?? '').trim().toLowerCase().slice(0, 254);
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 2000);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    back(id, 'error', 'That does not look like an email address.');
  }
  const { error } = await supabaseAdmin()
    .from('outreach_prospects')
    .update({ contact_email: email || null, notes: notes || null, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) back(id, 'error', 'Could not update the prospect.');
  revalidatePath(PAGE);
  back(id, 'ok', 'Prospect updated.');
}

/** The one deliberate click: approve a draft and send it from the store
 *  address. Refuses to send twice and refuses without a recipient. */
export async function approveAndSend(formData: FormData): Promise<void> {
  const session = await requireOutreach();
  const id = String(formData.get('message_id') ?? '');
  const prospectId = String(formData.get('prospect_id') ?? '') || null;
  if (!id) back(prospectId, 'error', 'Missing message.');

  const admin = supabaseAdmin();
  const { data: msg } = await admin
    .from('outreach_messages')
    .select('id, prospect_id, direction, status, subject, body')
    .eq('id', id)
    .maybeSingle();
  const m = msg as { id: string; prospect_id: string; direction: string; status: string; subject: string | null; body: string } | null;
  if (!m || m.direction !== 'out') back(prospectId, 'error', 'Message not found.');
  if (m.status !== 'draft') back(m.prospect_id, 'error', 'Already sent.');

  const { data: pr } = await admin
    .from('outreach_prospects')
    .select('id, domain, contact_email, status')
    .eq('id', m.prospect_id)
    .maybeSingle();
  const p = pr as { id: string; domain: string; contact_email: string | null; status: string } | null;
  if (!p) back(null, 'error', 'Prospect not found.');
  if (!p.contact_email) back(p.id, 'error', 'No contact email on this prospect yet. Add one above, then send.');

  const ok = await sendOutreachEmail({
    to: p.contact_email,
    subject: m.subject || `A note from Yellow Pink`,
    body: m.body,
  });
  if (!ok) back(p.id, 'error', 'The email was not sent (see Email log). Nothing was recorded.');

  // Send succeeded: record it. If this write fails the email is already out,
  // so log loudly rather than pretending it wasn't sent.
  const now = new Date().toISOString();
  const { error: upErr } = await admin
    .from('outreach_messages')
    .update({ status: 'sent', sent_at: now, sent_by: session.email ?? 'owner' })
    .eq('id', m.id);
  if (upErr) log.error('outreach.sent_record_failed', { message: m.id, error: upErr.message });
  if (p.status === 'draft' || p.status === 'ready') {
    await admin.from('outreach_prospects')
      .update({ status: 'sent', updated_at: now })
      .eq('id', p.id);
  }
  revalidatePath(PAGE);
  back(p.id, 'ok', `Sent to ${p.contact_email}.`);
}

/** Reply inside an open thread. Composed and sent in one step — the thread
 *  already has the owner's attention, so there is no separate draft stage. */
export async function sendReply(formData: FormData): Promise<void> {
  const session = await requireOutreach();
  const prospectId = String(formData.get('prospect_id') ?? '');
  const body = String(formData.get('body') ?? '').trim().slice(0, 8000);
  if (!prospectId || !body) back(prospectId || null, 'error', 'Write a message first.');

  const admin = supabaseAdmin();
  const { data: pr } = await admin
    .from('outreach_prospects')
    .select('id, contact_email')
    .eq('id', prospectId)
    .maybeSingle();
  const p = pr as { id: string; contact_email: string | null } | null;
  if (!p?.contact_email) back(prospectId, 'error', 'No contact email on this prospect.');

  // Continue the thread under the original subject.
  const { data: last } = await admin
    .from('outreach_messages')
    .select('subject')
    .eq('prospect_id', prospectId)
    .not('subject', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const baseSubject = (last as { subject: string | null } | null)?.subject ?? 'Yellow Pink';
  const subject = baseSubject.startsWith('Re:') ? baseSubject : `Re: ${baseSubject}`;

  const ok = await sendOutreachEmail({ to: p.contact_email!, subject, body });
  if (!ok) back(prospectId, 'error', 'The reply was not sent (see Email log).');

  await admin.from('outreach_messages').insert({
    prospect_id: prospectId,
    direction: 'out',
    subject,
    body,
    status: 'sent',
    sent_by: session.email ?? 'owner',
    sent_at: new Date().toISOString(),
  });
  revalidatePath(PAGE);
  back(prospectId, 'ok', 'Reply sent.');
}

/** Outcome bookkeeping: the link went live, or they said no, or went quiet. */
export async function markStatus(formData: FormData): Promise<void> {
  await requireOutreach();
  const id = String(formData.get('prospect_id') ?? '');
  const status = String(formData.get('status') ?? '');
  const linkUrl = String(formData.get('link_url') ?? '').trim().slice(0, 500);
  const allowed = ['link_live', 'declined', 'dead', 'sent', 'replied'];
  if (!id || !allowed.includes(status)) back(id || null, 'error', 'Bad status.');
  if (status === 'link_live' && !/^https?:\/\//.test(linkUrl)) {
    back(id, 'error', 'Paste the URL of the page that links to us.');
  }
  const { error } = await supabaseAdmin()
    .from('outreach_prospects')
    .update({
      status,
      ...(status === 'link_live' ? { link_url: linkUrl } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) back(id, 'error', 'Could not update the status.');
  revalidatePath(PAGE);
  back(id, 'ok', status === 'link_live' ? 'Link recorded. One more referring domain.' : 'Status updated.');
}
