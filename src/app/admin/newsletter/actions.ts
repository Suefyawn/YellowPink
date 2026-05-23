'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { can } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';
import { sendNewsletterBroadcastEmail, RESEND_DAILY_BATCH_CAP } from '@/lib/email';

export type SendCampaignResult =
  | { ok: true; recipientCount: number; sentCount: number }
  | { ok: false; error: string };

const CampaignSchema = z.object({
  subject: z.string().trim().min(3, 'Add a subject line.').max(200),
  body: z.string().trim().min(10, 'Write a bit more in the body.').max(20000),
});

// Every Supabase call in the send path is wrapped in this timeout. Without it,
// a slow/unreachable Supabase will hang the action indefinitely — no row
// written, no toast, no failure surfaced. 8s is well under Vercel's 60s
// maxDuration, so we still return a clean error instead of a 504.
const DB_TIMEOUT_MS = 8000;
function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

// Composes one branded email and mails it to the active subscriber list. The
// campaign row is written BEFORE the send so a run is never invisible, and the
// send is bounded to the daily Resend cap so it can't run long enough to hit
// the serverless function timeout (the bug this addresses — an unbounded loop
// over the whole list would be killed mid-send, hanging the UI). Anything
// beyond the cap is left unsent; the campaign row's recipient/sent counts
// surface the shortfall.
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

  let subs: { email: string | null }[] | null = null;
  try {
    const res = await withTimeout(
      admin.from('newsletter_subscribers').select('email').is('unsubscribed_at', null),
      DB_TIMEOUT_MS,
      'newsletter.subscribers_load',
    );
    if (res.error) {
      log.error('newsletter.subscribers_load_failed', { error: res.error.message });
      return { ok: false, error: 'Could not load the subscriber list. Please try again.' };
    }
    subs = res.data;
  } catch (err) {
    log.error('newsletter.subscribers_load_timeout', { error: (err as Error).message });
    return { ok: false, error: 'The subscriber list took too long to load. Please try again.' };
  }

  const emails = Array.from(new Set(
    (subs ?? [])
      .map(s => (s.email as string | null)?.trim().toLowerCase())
      .filter((e): e is string => !!e),
  ));
  if (emails.length === 0) {
    return { ok: false, error: 'There are no active subscribers to send to yet.' };
  }

  // Record the campaign up front, so a send is never invisible — even if the
  // run fails partway, the owner still sees a row in "Sent newsletters".
  let campaignId: string;
  try {
    const res = await withTimeout(
      admin
        .from('newsletter_campaigns')
        .insert({
          subject: parsed.data.subject,
          body: parsed.data.body,
          recipient_count: emails.length,
          sent_count: 0,
          sent_by: session?.email ?? null,
        })
        .select('id')
        .single(),
      DB_TIMEOUT_MS,
      'newsletter.campaign_insert',
    );
    if (res.error || !res.data) {
      log.error('newsletter.campaign_record_failed', { error: res.error?.message });
      return { ok: false, error: 'Could not start the campaign. Please try again.' };
    }
    campaignId = res.data.id as string;
  } catch (err) {
    log.error('newsletter.campaign_insert_timeout', { error: (err as Error).message });
    return { ok: false, error: 'Could not start the campaign — the database did not respond. Please try again.' };
  }

  // Resend's free tier caps batch/marketing mail at RESEND_DAILY_BATCH_CAP a
  // day. Attempt at most that many: the rest can't go out today regardless,
  // and looping the whole list is what made the request slow enough to be
  // killed by the serverless timeout. The per-send quota RPC still enforces
  // the exact remaining budget.
  const toSend = emails.slice(0, RESEND_DAILY_BATCH_CAP);

  let sentCount = 0;
  const CHUNK = 8;
  for (let i = 0; i < toSend.length; i += CHUNK) {
    const results = await Promise.all(
      toSend.slice(i, i + CHUNK).map(email =>
        sendNewsletterBroadcastEmail({ email, subject: parsed.data.subject, body: parsed.data.body })
          .catch(() => false),
      ),
    );
    sentCount += results.filter(Boolean).length;
  }

  // Best-effort: a failure here doesn't lose the campaign row (still visible),
  // it only leaves sent_count at 0. Swallow timeouts so the user gets a clean
  // success rather than an error after the emails have already gone out.
  try {
    await withTimeout(
      admin.from('newsletter_campaigns').update({ sent_count: sentCount }).eq('id', campaignId),
      DB_TIMEOUT_MS,
      'newsletter.campaign_update',
    );
  } catch (err) {
    log.error('newsletter.campaign_update_failed', { error: (err as Error).message });
  }

  // Fire-and-forget: the audit log is a nice-to-have, not part of the user's
  // success criterion. Awaiting it could re-introduce the original hang.
  void logAudit(session, {
    action: 'newsletter.send',
    entity: 'newsletter_campaign',
    entity_id: campaignId,
    diff: { subject: parsed.data.subject, recipientCount: emails.length, sentCount },
  }).catch(err => log.error('newsletter.audit_failed', { error: (err as Error).message }));
  log.info('newsletter.campaign_sent', { recipients: emails.length, sent: sentCount });

  // Refresh the server-rendered "Sent newsletters" table.
  revalidatePath('/admin/newsletter');

  return { ok: true, recipientCount: emails.length, sentCount };
}
