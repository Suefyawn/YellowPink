import { NextResponse, type NextRequest } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin, isDemo } from '@/lib/supabase';
import { verifyResendSignature } from '@/lib/resend-webhook';
import { log } from '@/lib/logger';

// Inbound-email webhook → Admin → Messages, via Resend's receiving feature.
//
// `hello@yellowpink.pk` has no mailbox; Resend receives mail for the domain
// and POSTs an `email.received` event here. That event carries metadata only
// (from / to / subject / email_id) — the body is fetched separately with
// resend.emails.receiving.get(email_id). We insert the message into the same
// `contact_messages` table the contact form uses (source='email'), so the
// notify_new_message trigger lights up the admin bell and the owner replies
// from Admin → Messages.
//
// Setup (owner, one-time):
//   1. Resend → Domains → add the receiving MX record for yellowpink.pk.
//   2. Resend → Webhooks → add an endpoint for the `email.received` event
//      pointing at https://www.yellowpink.pk/api/inbound-email, and copy its
//      signing secret into RESEND_INBOUND_WEBHOOK_SECRET (Vercel env).
//   (RESEND_API_KEY — already set for sending — is reused to fetch the body.)
//
// Auth: Resend's Svix signature (same scheme as /api/webhooks/resend). The
// endpoint is closed (503) until RESEND_INBOUND_WEBHOOK_SECRET is set.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX = { name: 120, email: 254, subject: 200, message: 5000 };

function clamp(v: unknown, n: number): string {
  return (v == null ? '' : String(v)).trim().slice(0, n);
}

// "Areej Saeed <areej@x.com>" / bare "areej@x.com" → { name, email }.
function parseFrom(from: unknown): { name: string; email: string } {
  const raw = clamp(from, 400);
  const angle = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (angle) {
    const email = clamp(angle[2], MAX.email).toLowerCase();
    return { name: clamp(angle[1] || email, MAX.name), email };
  }
  if (raw.includes('@')) {
    const email = clamp(raw, MAX.email).toLowerCase();
    return { name: clamp(email.split('@')[0], MAX.name), email };
  }
  return { name: '', email: '' };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|br|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'inbound email not configured' }, { status: 503 });
  }

  const raw = await req.text();
  if (!verifyResendSignature(secret, req.headers, raw)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let event: { type?: string; data?: { email_id?: string; from?: string; subject?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // Only inbound messages; ack anything else so Resend doesn't retry.
  if (event.type !== 'email.received' || !event.data?.email_id) {
    return NextResponse.json({ ok: true });
  }

  // Event has metadata only — fetch the body via the receiving API.
  let fromRaw: unknown = event.data.from;
  let subject = event.data.subject ?? '';
  let text = '';
  let html = '';
  if (process.env.RESEND_API_KEY) {
    try {
      const { data } = await new Resend(process.env.RESEND_API_KEY).emails.receiving.get(event.data.email_id);
      if (data) {
        fromRaw = data.from ?? fromRaw;
        subject = data.subject ?? subject;
        text = data.text ?? '';
        html = data.html ?? '';
      }
    } catch (err) {
      log.warn('inbound_email.body_fetch_failed', { error: (err as Error).message });
    }
  }

  const { name, email } = parseFrom(fromRaw);
  // No parseable sender → ack (can't attribute a reply address) rather than
  // making Resend retry a message we can never store usefully.
  if (!email) return NextResponse.json({ ok: true });

  const message = clamp(text || (html ? stripHtml(html) : '') || '(no text content)', MAX.message);

  if (isDemo) {
    log.info('inbound_email.demo', { email, subject });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseAdmin()
    .from('contact_messages')
    .insert({
      name: name || email.split('@')[0],
      email,
      subject: clamp(subject, MAX.subject) || null,
      message,
      source: 'email',
      user_agent: 'inbound-email (resend)',
    });
  if (error) {
    log.error('inbound_email.insert_failed', { error: error.message });
    // Valid event, our write failed — tell Resend to retry.
    return NextResponse.json({ error: 'insert failed' }, { status: 500 });
  }

  log.info('inbound_email.received', { email, subject });
  return NextResponse.json({ ok: true });
}
