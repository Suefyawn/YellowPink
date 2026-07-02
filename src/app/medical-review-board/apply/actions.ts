'use server';

import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { sendReviewerApplicationEmail } from '@/lib/email';
import { reviewerApplyLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { log } from '@/lib/logger';

export interface ApplyResult { ok: boolean; error?: string }

const str = (fd: FormData, k: string) => ((fd.get(k) as string | null) ?? '').trim();

/** Public Medical Review Board application. Inserts a pending row (vetting
 *  inbox) with the service-role client, reviewer_applications RLS is locked,
 *  so there is no anon write path, and alerts the owner to verify & approve. */
export async function submitReviewerApplication(
  _prev: ApplyResult | null,
  formData: FormData,
): Promise<ApplyResult> {
  const name = str(formData, 'name');
  const email = str(formData, 'email').toLowerCase();
  if (!name) return { ok: false, error: 'Please enter your full name.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Please enter a valid email address.' };

  // Unauthenticated write surface → per-IP rate limit before any DB work.
  const rl = await reviewerApplyLimiter.limit(ipFromHeaders(await headers()));
  if (!rl.success) {
    return { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' };
  }

  const topics = str(formData, 'review_topics').split(',').map(t => t.trim()).filter(Boolean);
  const credentials = str(formData, 'credentials') || null;
  const pmdc_number = str(formData, 'pmdc_number') || null;
  const specialty = str(formData, 'specialty') || null;
  const profile_url = str(formData, 'profile_url') || null;

  const admin = supabaseAdmin();

  // Soft de-dupe: ignore a repeat application while one is still pending.
  const { data: dupe } = await admin
    .from('reviewer_applications')
    .select('id').eq('email', email).eq('status', 'pending').maybeSingle();
  if (dupe) return { ok: true }; // already in the queue, show the same thank-you

  const { error } = await admin.from('reviewer_applications').insert({
    name, email, credentials, pmdc_number, specialty,
    bio: str(formData, 'bio') || null,
    profile_url,
    photo_url: str(formData, 'photo_url') || null,
    review_topics: topics,
    message: str(formData, 'message') || null,
  });
  if (error) {
    log.error('reviewer_application.insert_failed', { error: error.message });
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }

  // Best-effort owner alert, never fail the application if email is down.
  try {
    await sendReviewerApplicationEmail({ name, email, credentials, specialty, pmdc_number, profile_url });
  } catch (err) {
    log.warn('reviewer_application.email_failed', { err: err instanceof Error ? err.message : String(err) });
  }
  return { ok: true };
}
