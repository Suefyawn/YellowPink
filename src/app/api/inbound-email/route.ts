import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin, isDemo } from '@/lib/supabase';
import { log } from '@/lib/logger';

// Inbound-email webhook → Admin → Messages.
//
// `hello@yellowpink.pk` has no mailbox; this route lets a third-party inbound
// parser (Postmark Inbound, SendGrid Inbound Parse, or Mailgun Routes) POST a
// received email here so it lands in the same `contact_messages` table the
// storefront contact form uses. The `notify_new_message` trigger then lights
// up the admin bell, and the owner replies from Admin → Messages exactly as
// they do for form submissions.
//
// Setup (owner, one-time):
//   1. Set INBOUND_EMAIL_TOKEN in Vercel env (any long random secret).
//   2. In your inbound provider, point the parse/route webhook at
//      https://www.yellowpink.pk/api/inbound-email?key=<INBOUND_EMAIL_TOKEN>
//   3. Add the provider's MX records to the yellowpink.pk DNS so mail to
//      hello@ flows to the provider. (See docs/USER-MANUAL.md.)
//
// Auth: the shared secret (query `?key=` or `Authorization: Bearer`). Without
// INBOUND_EMAIL_TOKEN set, the endpoint is closed (503) so it's never an open
// inbox. Inserts via the service-role client (trusted server context).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX = { name: 120, email: 254, subject: 200, message: 5000 };

function clamp(v: unknown, n: number): string {
  return (v == null ? '' : String(v)).trim().slice(0, n);
}

// Parse "Areej Saeed <areej@x.com>" / bare "areej@x.com" into name + email.
function parseFrom(from: unknown, fallbackName?: unknown): { name: string; email: string } {
  const raw = clamp(from, 400);
  const angle = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (angle) {
    const email = clamp(angle[2], MAX.email).toLowerCase();
    return { name: clamp(angle[1] || fallbackName || email, MAX.name), email };
  }
  if (raw.includes('@')) {
    const email = clamp(raw, MAX.email).toLowerCase();
    return { name: clamp(fallbackName || email.split('@')[0], MAX.name), email };
  }
  return { name: clamp(fallbackName || 'Email sender', MAX.name), email: '' };
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
  const token = process.env.INBOUND_EMAIL_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'inbound email not configured' }, { status: 503 });
  }
  const provided =
    new URL(req.url).searchParams.get('key') ||
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (provided !== token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let name = '', email = '', subject = '', message = '';
  try {
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      // Postmark Inbound style.
      const b = (await req.json()) as Record<string, unknown> & { FromFull?: { Email?: string; Name?: string } };
      const fp = parseFrom(b.FromFull?.Email ?? b.From, b.FromName ?? b.FromFull?.Name);
      name = fp.name; email = fp.email;
      subject = clamp(b.Subject, MAX.subject);
      message = clamp(
        b.StrippedTextReply || b.TextBody || (b.HtmlBody ? stripHtml(String(b.HtmlBody)) : ''),
        MAX.message,
      );
    } else {
      // SendGrid Inbound Parse / Mailgun Routes (multipart or urlencoded form).
      const f = await req.formData();
      const g = (k: string) => f.get(k)?.toString() ?? '';
      const fp = parseFrom(g('from') || g('sender') || g('From'), g('from_name'));
      name = fp.name; email = fp.email;
      subject = clamp(g('subject') || g('Subject'), MAX.subject);
      const text = g('text') || g('body-plain') || g('stripped-text') || g('TextBody');
      const html = g('html') || g('body-html') || g('HtmlBody');
      message = clamp(text || (html ? stripHtml(html) : ''), MAX.message);
    }
  } catch (err) {
    log.error('inbound_email.parse_failed', { error: (err as Error).message });
    return NextResponse.json({ error: 'could not parse email' }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: 'missing sender email' }, { status: 422 });
  }
  if (!message) message = '(no text content)';

  if (isDemo) {
    log.info('inbound_email.demo', { email, subject });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseAdmin()
    .from('contact_messages')
    .insert({ name, email, subject: subject || null, message, source: 'email', user_agent: 'inbound-email' });
  if (error) {
    log.error('inbound_email.insert_failed', { error: error.message });
    return NextResponse.json({ error: 'insert failed' }, { status: 500 });
  }

  log.info('inbound_email.received', { email, subject });
  return NextResponse.json({ ok: true });
}
