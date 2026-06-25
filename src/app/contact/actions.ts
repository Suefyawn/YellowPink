'use server';

import { headers } from 'next/headers';
import { after } from 'next/server';
import { z } from 'zod';
import { supabase, isDemo } from '@/lib/supabase';
import { contactLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { log } from '@/lib/logger';
import { sendContactMessageEmail } from '@/lib/email';

// Contact-form server action — wired into the form on /page/contact.
//
// Writes to the contact_messages table (Admin → Messages) and forwards the
// submission to the owner via Resend (replyTo = the sender). Mirrors the
// newsletter action: validate → honeypot → rate-limit → insert → after()email.
//
// Returns a discriminated state for `useActionState`:
//   { ok: true }                   on success
//   { ok: false, error: string }   on validation / rate-limit failure

const ContactSchema = z.object({
  name: z.string().trim().min(1, 'Please add your name.').max(120),
  email: z.string().trim().email('Please enter a valid email address.').max(254),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1, 'Please write a message.').max(5000),
  // Honeypot — bots fill this; real users never see it.
  website: z.string().max(0).optional(),
});

export type ContactState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

export async function submitContactMessage(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const parsed = ContactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form and try again.' };
  }
  const { name, email, subject, message, website } = parsed.data;
  // Honeypot tripped — silent success so the bot moves on without learning anything.
  if (website) return { ok: true };

  const hdrs = await headers();
  const ip = ipFromHeaders(hdrs);
  const ua = hdrs.get('user-agent')?.slice(0, 240) ?? null;

  const rl = await contactLimiter.limit(ip);
  if (!rl.success) {
    return { ok: false, error: 'Too many messages from this connection. Please try again later.' };
  }

  const normalisedEmail = email.toLowerCase();
  const cleanSubject = subject && subject.length > 0 ? subject : null;

  if (isDemo) {
    log.info('contact.demo_submit', { email: normalisedEmail, subject: cleanSubject });
    after(() => sendContactMessageEmail({ name, email: normalisedEmail, subject: cleanSubject, message }));
    return { ok: true };
  }

  try {
    const { error } = await supabase
      .from('contact_messages')
      .insert({
        name,
        email: normalisedEmail,
        subject: cleanSubject,
        message,
        source: 'contact_form',
        user_agent: ua,
        ip_address: ip === 'unknown' ? null : ip,
      });
    if (error) {
      log.error('contact.insert_failed', { error: error.message });
      return { ok: false, error: 'Something went wrong sending your message. Please try again.' };
    }
    // Forward to the owner after the response is sent (see the newsletter
    // action for why after() is needed over a bare void on Vercel).
    after(() => sendContactMessageEmail({ name, email: normalisedEmail, subject: cleanSubject, message }));
    return { ok: true };
  } catch (err) {
    log.error('contact.unexpected', { error: (err as Error).message });
    return { ok: false, error: 'Something went wrong sending your message. Please try again.' };
  }
}
