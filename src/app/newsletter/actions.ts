'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { supabase, isDemo } from '@/lib/supabase';
import { newsletterLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { log } from '@/lib/logger';

// Newsletter signup server action — wired into the footer form, post-purchase
// opt-in, and the timed / exit-intent modal.
//
// Returns a discriminated state for `useActionState`:
//   { ok: true, email }            on success
//   { ok: false, error: string }   on validation / rate-limit failure
//
// In demo mode (no Supabase env) we still validate + rate-limit, but skip the
// DB insert and log the would-be subscription so the form feels real.

const SOURCE_VALUES = ['footer', 'modal', 'exit_intent', 'checkout', 'post_purchase'] as const;
const SignupSchema = z.object({
  email: z.string().email().max(254),
  source: z.enum(SOURCE_VALUES).default('footer'),
  // Honeypot — bots fill this; real users never see it.
  website: z.string().max(0).optional(),
});

export type NewsletterState =
  | { ok: true; email: string }
  | { ok: false; error: string }
  | null;

export async function subscribeToNewsletter(
  _prev: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const raw = Object.fromEntries(formData);
  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }
  const { email, source, website } = parsed.data;
  // Honeypot tripped — silent success so the bot moves on without learning anything.
  if (website) return { ok: true, email };

  const hdrs = await headers();
  const ip = ipFromHeaders(hdrs);
  const ua = hdrs.get('user-agent')?.slice(0, 240) ?? null;

  const rl = await newsletterLimiter.limit(ip);
  if (!rl.success) {
    return { ok: false, error: 'Too many requests, please try again later.' };
  }

  if (isDemo) {
    log.info('newsletter.demo_subscribe', { email, source });
    return { ok: true, email };
  }

  try {
    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email: email.toLowerCase().trim(),
        source,
        user_agent: ua,
        ip_address: ip === 'unknown' ? null : ip,
      });
    // Unique-violation = already subscribed; treat as success so we don't leak
    // membership via response shape (timing-attack-ish concern).
    if (error && error.code !== '23505') {
      log.error('newsletter.insert_failed', { error: error.message });
      return { ok: false, error: 'Something went wrong. Please try again.' };
    }
    return { ok: true, email };
  } catch (err) {
    log.error('newsletter.unexpected', { error: (err as Error).message });
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}
