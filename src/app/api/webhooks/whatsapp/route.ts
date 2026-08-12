// WhatsApp Cloud API webhook.
//
// Two jobs:
//   GET  — Meta's one-time subscription handshake (echo hub.challenge).
//   POST — inbound events: the customer's Confirm/Cancel button tap, plus
//          Meta's sent → delivered → read status callbacks.
//
// A CONFIRM tap sets orders.confirmed_at, which is the same field staff set
// by hand today, so the whole downstream workflow (dispatch readiness, the
// unconfirmed-order escalation, the COD refusal flag's "confirmed" test)
// works unchanged — it just no longer waits for a human to be awake.
// A CANCEL tap never cancels the order on its own; it rings the admin bell
// so a person decides.
//
// Setup (owner, one-time): Meta → WhatsApp → Configuration → Webhook,
// callback URL <site>/api/webhooks/whatsapp, verify token =
// WHATSAPP_VERIFY_TOKEN, subscribe to the "messages" field.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseButtonPayload, sendTextMessage } from '@/lib/whatsapp-cloud';
import { log } from '@/lib/logger';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// ─── Meta subscription handshake ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const verify = process.env.WHATSAPP_VERIFY_TOKEN;
  const params = req.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (!verify) {
    log.warn('whatsapp_webhook.no_verify_token');
    return new NextResponse('webhook not configured', { status: 503 });
  }
  if (mode === 'subscribe' && token === verify && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('forbidden', { status: 403 });
}

// ─── Inbound events ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!process.env.WHATSAPP_VERIFY_TOKEN) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }

  // Meta retries on any non-2xx, so we always answer 200 after this point and
  // log problems instead — a retry storm would multiply button taps.
  let payload: WaWebhookBody;
  try {
    payload = (await req.json()) as WaWebhookBody;
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;
        for (const status of value.statuses ?? []) await handleStatus(status);
        for (const message of value.messages ?? []) await handleMessage(message);
      }
    }
  } catch (err) {
    log.error('whatsapp_webhook.handler_error', { error: (err as Error).message });
  }
  return NextResponse.json({ ok: true });
}

async function handleStatus(s: WaStatus) {
  if (!s.id || !s.status) return;
  const mapped =
    s.status === 'delivered' ? 'delivered'
    : s.status === 'read' ? 'read'
    : s.status === 'failed' ? 'failed'
    : null;
  if (!mapped) return; // 'sent' is already our insert state
  await admin()
    .from('whatsapp_messages')
    .update({
      status: mapped,
      error: s.errors?.[0]?.title ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('message_id', s.id);
}

async function handleMessage(m: WaMessage) {
  const parsed = parseButtonPayload(m.button?.payload ?? m.interactive?.button_reply?.id);
  if (!parsed) return; // free-form customer message: staff handle it in WhatsApp
  const db = admin();

  const { data: orderRow } = await db
    .from('orders')
    .select('id, order_number, status, confirmed_at, first_name, phone')
    .eq('order_number', parsed.orderNumber)
    .maybeSingle();
  const order = orderRow as null | {
    id: string; order_number: string; status: string | null;
    confirmed_at: string | null; first_name: string | null; phone: string | null;
  };
  if (!order) {
    log.warn('whatsapp_webhook.unknown_order', { order: parsed.orderNumber });
    return;
  }

  // Record the reply against the message log (best-effort; the order action
  // below is what actually matters).
  await db
    .from('whatsapp_messages')
    .update({ reply: parsed.action, replied_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('order_number', order.order_number)
    .is('reply', null);

  if (parsed.action === 'confirm') {
    // Idempotent: a double-tap must not re-stamp or re-notify.
    if (order.confirmed_at) return;
    await db
      .from('orders')
      .update({ confirmed_at: new Date().toISOString() })
      .eq('id', order.id);
    await db.from('audit_log').insert({
      action: 'order.customer_confirmed',
      entity: 'orders',
      entity_id: order.id,
      actor_email: 'whatsapp-bot',
      diff: { via: 'whatsapp_button', order_number: order.order_number },
    });
    await db.from('admin_notifications').insert({
      kind: 'order_confirmed_whatsapp',
      title: `Order ${order.order_number} confirmed by the customer`,
      body: 'The customer tapped Confirm on WhatsApp. Ready to pack and dispatch.',
      link: `/admin/orders/${order.id}`,
      entity_id: order.order_number,
    });
    void sendTextMessage({
      phone: order.phone,
      text: `Thank you${order.first_name ? ', ' + order.first_name : ''}! Order ${order.order_number} is confirmed. We'll pack it and send your tracking details here.`,
    });
    log.info('whatsapp_webhook.order_confirmed', { order: order.order_number });
    return;
  }

  // CANCEL: a customer tap is a request, not an instruction — staff decide,
  // because cancelling touches stock, vendor dispatch and courier bookings.
  await db.from('admin_notifications').insert({
    kind: 'order_cancel_requested_whatsapp',
    title: `Order ${order.order_number}: customer tapped Cancel`,
    body: 'The customer asked to cancel on WhatsApp. Review and action it, then reply to them on the same chat.',
    link: `/admin/orders/${order.id}`,
    entity_id: order.order_number,
  });
  void sendTextMessage({
    phone: order.phone,
    text: `Thanks for letting us know. We've received your cancellation request for order ${order.order_number} and our team will confirm it shortly.`,
  });
  log.info('whatsapp_webhook.cancel_requested', { order: order.order_number });
}

// ─── Meta payload shapes (only the fields we read) ──────────────────────────
interface WaWebhookBody { entry?: Array<{ changes?: Array<{ value?: WaValue }> }> }
interface WaValue { messages?: WaMessage[]; statuses?: WaStatus[] }
interface WaMessage {
  from?: string;
  button?: { payload?: string; text?: string };
  interactive?: { button_reply?: { id?: string; title?: string } };
}
interface WaStatus {
  id?: string;
  status?: string;
  errors?: Array<{ title?: string }>;
}
