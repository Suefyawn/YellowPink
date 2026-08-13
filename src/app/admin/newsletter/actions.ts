'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { can } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';
import { logActionError } from '@/lib/action-log';
import { fetchAll } from '@/lib/fetch-all';
import { sendNewsletterBroadcastEmail, RESEND_DAILY_BATCH_CAP } from '@/lib/email';

export type SendCampaignResult =
  | { ok: true; recipientCount: number; sentCount: number }
  | { ok: false; error: string };

const CampaignSchema = z.object({
  subject: z.string().trim().min(3, 'Add a subject line.').max(200),
  body: z.string().trim().min(10, 'Write a bit more in the body.').max(20000),
});

// Every Supabase call in the send path is wrapped in this timeout. Without it,
// a slow/unreachable Supabase will hang the action indefinitely, no row
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
// the serverless function timeout (the bug this addresses, an unbounded loop
// over the whole list would be killed mid-send, hanging the UI). Anything
// beyond the cap is left unsent; the campaign row's recipient/sent counts
// surface the shortfall.
export type CampaignAudience = 'subscribers' | 'customers' | 'both';

export async function sendNewsletterCampaign(
  subject: string,
  body: string,
  /** When sending a saved draft, its row is promoted to 'sent' instead of a
   *  new campaign row being inserted, so the edition doesn't double up. */
  draftId?: string,
  /** Who receives it. 'customers' pulls every distinct order email;
   *  'both' unions the lists. Anyone who unsubscribed from the newsletter is
   *  excluded from every audience — an unsubscribe means all marketing mail,
   *  not just the list they clicked it from. */
  audience: CampaignAudience = 'subscribers',
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
  const emailSet = new Set<string>();

  // Opt-outs bar every audience.
  let unsubscribed = new Set<string>();
  try {
    const res = await withTimeout(
      fetchAll<{ email: string | null }>(
        admin
          .from('newsletter_subscribers')
          .select('email')
          .not('unsubscribed_at', 'is', null)
          .order('id', { ascending: true }),
      ),
      DB_TIMEOUT_MS,
      'newsletter.unsubscribed_load',
    );
    unsubscribed = new Set(
      ((res.data ?? []) as Array<{ email: string | null }>)
        .map(s => s.email?.trim().toLowerCase())
        .filter((e): e is string => !!e),
    );
  } catch {
    // Unavailable opt-out list must fail closed for customer sends (we could
    // mail someone who opted out); subscribers-only is inherently safe since
    // that list already excludes them.
    if (audience !== 'subscribers') {
      return { ok: false, error: 'Could not load the unsubscribe list, so a customer send would risk mailing someone who opted out. Please try again.' };
    }
  }

  if (audience !== 'customers') {
    try {
      // fetchAll pages past PostgREST's silent 1000-row cap; without it the
      // campaign never reached subscriber #1001. Stable order keeps pages
      // consistent while the walk runs.
      const res = await withTimeout(
        fetchAll<{ email: string | null }>(
          admin
            .from('newsletter_subscribers')
            .select('email')
            .is('unsubscribed_at', null)
            .order('id', { ascending: true }),
        ),
        DB_TIMEOUT_MS,
        'newsletter.subscribers_load',
      );
      if (res.error) {
        log.error('newsletter.subscribers_load_failed', { error: res.error.message });
        return { ok: false, error: 'Could not load the subscriber list. Please try again.' };
      }
      for (const s of (res.data ?? []) as Array<{ email: string | null }>) {
        const e = s.email?.trim().toLowerCase();
        if (e) emailSet.add(e);
      }
    } catch (err) {
      log.error('newsletter.subscribers_load_timeout', { error: (err as Error).message });
      return { ok: false, error: 'The subscriber list took too long to load. Please try again.' };
    }
  }

  if (audience !== 'subscribers') {
    try {
      const res = await withTimeout(
        fetchAll<{ email: string | null }>(
          admin
            .from('orders')
            .select('email')
            .not('email', 'is', null)
            .order('id', { ascending: true }),
        ),
        DB_TIMEOUT_MS,
        'newsletter.customers_load',
      );
      if (res.error) {
        log.error('newsletter.customers_load_failed', { error: res.error.message });
        return { ok: false, error: 'Could not load the customer list. Please try again.' };
      }
      for (const o of (res.data ?? []) as Array<{ email: string | null }>) {
        const e = o.email?.trim().toLowerCase();
        if (e && !unsubscribed.has(e)) emailSet.add(e);
      }
    } catch (err) {
      log.error('newsletter.customers_load_timeout', { error: (err as Error).message });
      return { ok: false, error: 'The customer list took too long to load. Please try again.' };
    }
  }

  const emails = Array.from(emailSet);
  if (emails.length === 0) {
    return { ok: false, error: 'There is nobody in that audience to send to yet.' };
  }

  // Record the campaign up front, so a send is never invisible, even if the
  // run fails partway, the owner still sees a row in "Sent newsletters".
  // A draft send promotes the existing row (status → 'sent', timestamp reset
  // to the actual send moment); a direct send inserts a fresh 'sent' row.
  let campaignId: string;
  try {
    const write = draftId
      ? admin
          .from('newsletter_campaigns')
          .update({
            subject: parsed.data.subject,
            body: parsed.data.body,
            recipient_count: emails.length,
            sent_count: 0,
            sent_by: session?.email ?? null,
            status: 'sent',
            created_at: new Date().toISOString(),
          })
          .eq('id', draftId)
          .eq('status', 'draft')
          .select('id')
          .single()
      : admin
          .from('newsletter_campaigns')
          .insert({
            subject: parsed.data.subject,
            body: parsed.data.body,
            recipient_count: emails.length,
            sent_count: 0,
            sent_by: session?.email ?? null,
            status: 'sent',
          })
          .select('id')
          .single();
    const res = await withTimeout(write, DB_TIMEOUT_MS, 'newsletter.campaign_insert');
    if (res.error || !res.data) {
      log.error('newsletter.campaign_record_failed', { error: res.error?.message, draft_id: draftId ?? null });
      return {
        ok: false,
        error: draftId
          ? 'That draft no longer exists (it may already have been sent). Refresh and try again.'
          : 'Could not start the campaign. Please try again.',
      };
    }
    campaignId = res.data.id as string;
  } catch (err) {
    log.error('newsletter.campaign_insert_timeout', { error: (err as Error).message });
    return { ok: false, error: 'Could not start the campaign, the database did not respond. Please try again.' };
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
          .catch(err => {
            // Swallowing kept the send loop alive but hid provider failures
            // entirely; log + Sentry-capture, still count the send as failed.
            logActionError('newsletter.broadcast_send', err, { campaign_id: campaignId });
            return false;
          }),
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

// ─── Drafts ──────────────────────────────────────────────────────────────────
// An edition can be written (or machine-prepared) ahead of time, reviewed in
// the composer, and only then sent. Drafts live in newsletter_campaigns with
// status 'draft' and zero counts; sending promotes the same row.

export type DraftResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveNewsletterDraft(
  draftId: string | null,
  subject: string,
  body: string,
): Promise<DraftResult> {
  const session = await getStaffSession();
  if (!can(session, 'newsletter')) {
    return { ok: false, error: 'You do not have permission to edit the newsletter.' };
  }
  const parsed = CampaignSchema.safeParse({ subject, body });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const admin = supabaseAdmin();
  try {
    const write = draftId
      ? admin
          .from('newsletter_campaigns')
          .update({ subject: parsed.data.subject, body: parsed.data.body, sent_by: session?.email ?? null })
          .eq('id', draftId)
          .eq('status', 'draft')
          .select('id')
          .single()
      : admin
          .from('newsletter_campaigns')
          .insert({
            subject: parsed.data.subject,
            body: parsed.data.body,
            recipient_count: 0,
            sent_count: 0,
            sent_by: session?.email ?? null,
            status: 'draft',
          })
          .select('id')
          .single();
    const res = await withTimeout(write, DB_TIMEOUT_MS, 'newsletter.draft_save');
    if (res.error || !res.data) {
      log.error('newsletter.draft_save_failed', { error: res.error?.message });
      return { ok: false, error: 'Could not save the draft. Please try again.' };
    }
    void logAudit(session, {
      action: draftId ? 'newsletter.draft_update' : 'newsletter.draft_create',
      entity: 'newsletter_campaign',
      entity_id: res.data.id as string,
      diff: { subject: parsed.data.subject },
    }).catch(() => {});
    revalidatePath('/admin/newsletter');
    return { ok: true, id: res.data.id as string };
  } catch (err) {
    log.error('newsletter.draft_save_timeout', { error: (err as Error).message });
    return { ok: false, error: 'The draft save took too long. Please try again.' };
  }
}

export async function deleteNewsletterDraft(draftId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getStaffSession();
  if (!can(session, 'newsletter')) {
    return { ok: false, error: 'You do not have permission to edit the newsletter.' };
  }
  const admin = supabaseAdmin();
  try {
    // Guarded to status 'draft' so a sent campaign's history can never be
    // deleted through this path.
    const res = await withTimeout(
      admin.from('newsletter_campaigns').delete().eq('id', draftId).eq('status', 'draft'),
      DB_TIMEOUT_MS,
      'newsletter.draft_delete',
    );
    if (res.error) {
      log.error('newsletter.draft_delete_failed', { error: res.error.message });
      return { ok: false, error: 'Could not delete the draft. Please try again.' };
    }
    void logAudit(session, {
      action: 'newsletter.draft_delete',
      entity: 'newsletter_campaign',
      entity_id: draftId,
    }).catch(() => {});
    revalidatePath('/admin/newsletter');
    return { ok: true };
  } catch (err) {
    log.error('newsletter.draft_delete_timeout', { error: (err as Error).message });
    return { ok: false, error: 'The delete took too long. Please try again.' };
  }
}

// ─── Subscriber CRUD ─────────────────────────────────────────────────────────
// Admin-side management of the subscriber list. "Remove" is soft, sets
// unsubscribed_at so the unsubscribe trail matches what the storefront link
// would produce, and the row stays for history. Email edits normalise to
// lowercase to match the lookup the storefront signup uses.

export type SubscriberMutationResult =
  | { ok: true }
  | { ok: false; error: string };

const EMAIL_SCHEMA = z.string().trim().toLowerCase().email('Enter a valid email address.');
const SOURCE_SCHEMA = z.string().trim().min(1).max(40).default('admin');

async function assertNewsletter() {
  const session = await getStaffSession();
  if (!can(session, 'newsletter')) {
    return { ok: false as const, error: 'You do not have permission to manage subscribers.' };
  }
  return { ok: true as const, session };
}

export async function addSubscriber(
  email: string,
  source: string = 'admin',
): Promise<SubscriberMutationResult> {
  const gate = await assertNewsletter();
  if (!gate.ok) return gate;

  const parsedEmail = EMAIL_SCHEMA.safeParse(email);
  if (!parsedEmail.success) {
    return { ok: false, error: parsedEmail.error.issues[0]?.message ?? 'Invalid email.' };
  }
  const parsedSource = SOURCE_SCHEMA.safeParse(source);
  if (!parsedSource.success) {
    return { ok: false, error: 'Invalid source.' };
  }

  const admin = supabaseAdmin();
  // upsert-by-email so re-adding a previously unsubscribed person reactivates
  // them in one shot, rather than failing on the UNIQUE constraint.
  const { data: existing } = await admin
    .from('newsletter_subscribers')
    .select('id, unsubscribed_at')
    .eq('email', parsedEmail.data)
    .maybeSingle();

  let id: string;
  if (existing) {
    id = existing.id as string;
    if (existing.unsubscribed_at) {
      const { error } = await admin
        .from('newsletter_subscribers')
        .update({ unsubscribed_at: null, source: parsedSource.data })
        .eq('id', id);
      if (error) {
        log.error('newsletter.subscriber_reactivate_failed', { error: error.message });
        return { ok: false, error: 'Could not reactivate this subscriber.' };
      }
    } else {
      return { ok: false, error: 'That email is already subscribed.' };
    }
  } else {
    const { data, error } = await admin
      .from('newsletter_subscribers')
      .insert({
        email: parsedEmail.data,
        source: parsedSource.data,
        marketing_consent: true,
      })
      .select('id')
      .single();
    if (error || !data) {
      log.error('newsletter.subscriber_insert_failed', { error: error?.message });
      return { ok: false, error: 'Could not add this subscriber.' };
    }
    id = data.id as string;
  }

  void logAudit(gate.session, {
    action: 'newsletter_subscriber.create',
    entity: 'newsletter_subscriber',
    entity_id: id,
    diff: { email: parsedEmail.data, source: parsedSource.data },
  });
  revalidatePath('/admin/newsletter');
  return { ok: true };
}

export async function updateSubscriber(
  id: string,
  email: string,
  source: string,
): Promise<SubscriberMutationResult> {
  const gate = await assertNewsletter();
  if (!gate.ok) return gate;

  const parsedEmail = EMAIL_SCHEMA.safeParse(email);
  if (!parsedEmail.success) {
    return { ok: false, error: parsedEmail.error.issues[0]?.message ?? 'Invalid email.' };
  }
  const parsedSource = SOURCE_SCHEMA.safeParse(source);
  if (!parsedSource.success) return { ok: false, error: 'Invalid source.' };

  const admin = supabaseAdmin();
  const { error } = await admin
    .from('newsletter_subscribers')
    .update({ email: parsedEmail.data, source: parsedSource.data })
    .eq('id', id);
  if (error) {
    log.error('newsletter.subscriber_update_failed', { error: error.message });
    // Postgres 23505, UNIQUE on email
    if ((error as { code?: string }).code === '23505') {
      return { ok: false, error: 'Another subscriber already uses that email.' };
    }
    return { ok: false, error: 'Could not update this subscriber.' };
  }

  void logAudit(gate.session, {
    action: 'newsletter_subscriber.update',
    entity: 'newsletter_subscriber',
    entity_id: id,
    diff: { email: parsedEmail.data, source: parsedSource.data },
  });
  revalidatePath('/admin/newsletter');
  return { ok: true };
}

export async function setSubscriberUnsubscribed(
  id: string,
  unsubscribed: boolean,
): Promise<SubscriberMutationResult> {
  const gate = await assertNewsletter();
  if (!gate.ok) return gate;

  const admin = supabaseAdmin();
  const { data: row, error: readErr } = await admin
    .from('newsletter_subscribers')
    .select('email')
    .eq('id', id)
    .maybeSingle();
  if (readErr || !row) {
    return { ok: false, error: 'Subscriber not found.' };
  }

  const { error } = await admin
    .from('newsletter_subscribers')
    .update({ unsubscribed_at: unsubscribed ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) {
    log.error('newsletter.subscriber_unsubscribe_failed', { error: error.message });
    return { ok: false, error: 'Could not change the subscription status.' };
  }

  void logAudit(gate.session, {
    action: unsubscribed
      ? 'newsletter_subscriber.unsubscribe'
      : 'newsletter_subscriber.resubscribe',
    entity: 'newsletter_subscriber',
    entity_id: id,
    diff: { email: row.email },
  });
  revalidatePath('/admin/newsletter');
  return { ok: true };
}
