import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';

// The one path nothing else covers: an inbound email arriving at the webhook
// and threading onto an outreach prospect instead of the Messages inbox.
// Drives the REAL route handler with a genuinely signed payload — only the
// storage and the Resend body-fetch are mocked.

const SECRET_KEY = Buffer.from('test-webhook-secret-0123456789ab').toString('base64');
const SECRET = `whsec_${SECRET_KEY}`;

interface Row { [k: string]: unknown }
const inserts: Record<string, Row[]> = {};
const updates: Record<string, Row[]> = {};
let prospectMatch: Row | null = null;

function chain(table: string) {
  const c = {
    select: () => c,
    or: () => c,
    limit: () => c,
    eq: () => (updates[table] ? c : c),
    maybeSingle: async () => ({ data: prospectMatch, error: null }),
    insert: async (row: Row) => {
      (inserts[table] ??= []).push(row);
      return { data: null, error: null };
    },
    update: (row: Row) => {
      (updates[table] ??= []).push(row);
      return { eq: async () => ({ data: null, error: null }) };
    },
  };
  return c;
}

vi.mock('@/lib/supabase', () => ({
  isDemo: false,
  supabaseAdmin: () => ({ from: (table: string) => chain(table) }),
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      receiving: {
        get: async () => ({
          data: {
            from: 'Areej <areej@fuchsiamagazine.com>',
            subject: 'Re: Picks for your roundup',
            text: 'Sounds interesting, send them over.',
          },
        }),
      },
    };
  },
}));

function signedRequest(payload: object): Request {
  const body = JSON.stringify(payload);
  const id = 'msg_test1';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sig = createHmac('sha256', Buffer.from(SECRET_KEY, 'base64'))
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');
  return new Request('http://localhost/api/inbound-email', {
    method: 'POST',
    body,
    headers: {
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${sig}`,
    },
  });
}

const EVENT = { type: 'email.received', data: { email_id: 'em_1', from: 'areej@fuchsiamagazine.com', subject: 'Re: Picks' } };

describe('inbound email → outreach threading', () => {
  beforeEach(() => {
    for (const k of Object.keys(inserts)) delete inserts[k];
    for (const k of Object.keys(updates)) delete updates[k];
    prospectMatch = null;
    process.env.RESEND_INBOUND_WEBHOOK_SECRET = SECRET;
    process.env.RESEND_API_KEY = 'test-key';
  });

  it('rejects an unsigned request', async () => {
    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost/api/inbound-email', { method: 'POST', body: '{}' }) as never);
    expect(res.status).toBe(401);
  });

  it('threads a reply from a known prospect and rings the bell, skipping Messages', async () => {
    prospectMatch = { id: 'p-1', domain: 'fuchsiamagazine.com', status: 'sent' };
    const { POST } = await import('./route');
    const res = await POST(signedRequest(EVENT) as never);
    expect(res.status).toBe(200);

    // Threaded onto the prospect…
    expect(inserts['outreach_messages']).toHaveLength(1);
    expect(inserts['outreach_messages'][0]).toMatchObject({
      prospect_id: 'p-1', direction: 'in', status: 'received',
    });
    // …prospect flipped to replied…
    expect(updates['outreach_prospects'][0]).toMatchObject({ status: 'replied' });
    // …bell rung with the outreach kind…
    expect(inserts['admin_notifications'][0]).toMatchObject({ kind: 'outreach_reply', entity_id: 'p-1' });
    // …and NOT duplicated into the general inbox.
    expect(inserts['contact_messages']).toBeUndefined();
  });

  it('a won link is never demoted by a further reply', async () => {
    prospectMatch = { id: 'p-2', domain: 'fuchsiamagazine.com', status: 'link_live' };
    const { POST } = await import('./route');
    await POST(signedRequest(EVENT) as never);
    expect(inserts['outreach_messages']).toHaveLength(1);
    expect(updates['outreach_prospects']).toBeUndefined();
  });

  it('mail from a stranger still lands in Messages', async () => {
    prospectMatch = null;
    const { POST } = await import('./route');
    const res = await POST(signedRequest(EVENT) as never);
    expect(res.status).toBe(200);
    expect(inserts['contact_messages']).toHaveLength(1);
    expect(inserts['outreach_messages']).toBeUndefined();
  });
});
