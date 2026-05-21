'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { can } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';
import { sendNewsletterBroadcastEmail } from '@/lib/email';

export type SendCampaignResult =
  | { ok: true; recipientCount: number; sentCount: number }
  | { ok: false; error: string };

const CampaignSchema = z.object({
  subject: z.string().trim().min(3, 'Add a subject line.').max(200),
  body: z.string().trim().min(10, 'Write a bit more in the body.').max(20000),
});

// Composes one branded email and mails it to every active subscriber. Sends
// in small parallel chunks so a modest list finishes in a few seconds while
// staying inside Resend's rate limit; send() carries the daily free-tier cap,
// so anything beyond it is skipped (counted as not sent) rather than errored.
export async function sendNewsletterCampaign(
  subject: string,
  body: string,
): Promise<SendCampaignResult> {
  const session = await getStaffSession();
  if (!can(session, 'newsletter')) {
    return { ok: false, error: 'You do not have permission to send the newsletter.' };
  }

  const parsed = CampaignSchema.safeParse({ subject, body });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const admin = supabaseAdmin();
  const { data: subs, error } = await admin
    .from('newsletter_subscribers')
    .select('email')
    .is('unsubscribed_at', null);
  if (error) {
    log.error('newsletter.subscribers_load_failed', { error: error.message });
    return { ok: false, error: 'Could not load the subscriber list. Please try again.' };
  }

  const emails = Array.from(new Set(
    (subs ?? [])
      .map(s => (s.email as string | null)?.trim().toLowerCase())
      .filter((e): e is string => !!e),
  ));
  if (emails.length === 0) {
    return { ok: false, error: 'There are no active subscribers to send to yet.' };
  }

  let sentCount = 0;
  const CHUNK = 8;
  for (let i = 0; i < emails.length; i += CHUNK) {
    const results = await Promise.all(
      emails.slice(i, i + CHUNK).map(email =>
        sendNewsletterBroadcastEmail({ email, subject: parsed.data.subject, body: parsed.data.body })
          .catch(() => false),
      ),
    );
    sentCount += results.filter(Boolean).length;
  }

  // Always record the campaign — even a 0-sent (failed/skipped) run must
  // leave a row in "Sent newsletters" so the send is never invisible.
  const { error: campaignError } = await admin.from('newsletter_campaigns').insert({
    subject: parsed.data.subject,
    body: parsed.data.body,
    recipient_count: emails.length,
    sent_count: sentCount,
    sent_by: session?.email ?? null,
  });
  if (campaignError) {
    log.error('newsletter.campaign_record_failed', { error: campaignError.message });
  }

  await logAudit(session, {
    action: 'newsletter.send',
    entity: 'newsletter_campaign',
    diff: { subject: parsed.data.subject, recipientCount: emails.length, sentCount },
  });
  log.info('newsletter.campaign_sent', { recipients: emails.length, sent: sentCount });

  // Refresh the server-rendered "Sent newsletters" table.
  revalidatePath('/admin/newsletter');

  return { ok: true, recipientCount: emails.length, sentCount };
}
