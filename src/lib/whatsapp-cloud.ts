// ============================================================================
// WhatsApp Business Platform (Cloud API) — automated order messages.
//
// This is the PAID, automated channel, distinct from lib/whatsapp.ts (free
// wa.me deep links the customer or staff tap manually). Here Meta delivers
// the message itself, seconds after checkout, with no human involved — the
// gap that left order YP-4EZ30H965 unacknowledged overnight.
//
// Fail-soft by design: every function returns a result instead of throwing,
// and the whole module no-ops when unconfigured, so a Meta outage, an
// expired token or a not-yet-approved template can never break checkout.
//
// Env (all required before anything sends):
//   WHATSAPP_PHONE_NUMBER_ID   Meta → WhatsApp → API Setup ("Phone number ID",
//                              a numeric id, NOT the phone number itself)
//   WHATSAPP_ACCESS_TOKEN      System-user permanent token (the 24h test
//                              token expires; see docs/WHATSAPP-SETUP.md)
//   WHATSAPP_VERIFY_TOKEN      Any random string; must match what you type
//                              into Meta's webhook config
//   WHATSAPP_TEMPLATE_ORDER_CONFIRM  Approved template name
//                              (default: order_confirmation)
//   WHATSAPP_TEMPLATE_LOCALE   Template language code (default: en)
//
// Cost note: Pakistan utility-template conversations are billed per 24h
// conversation window, roughly PKR 4–12 at time of writing. One message per
// order is the intended volume.
// ============================================================================

import { log } from '@/lib/logger';

const GRAPH_VERSION = 'v21.0';

export interface WaSendResult {
  ok: boolean;
  /** Meta's message id (wamid...), for correlating webhook status events. */
  messageId?: string;
  error?: string;
}

export function isWhatsAppCloudConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_ACCESS_TOKEN,
  );
}

/** Pakistani mobile → E.164 digits without '+', which is what Meta expects.
 *  Mirrors the normalisation used by the COD-flag module so the same customer
 *  resolves identically across systems. */
export function toE164Digits(phone: string | null | undefined): string | null {
  const d = (phone ?? '').replace(/\D+/g, '');
  if (!d) return null;
  if (d.startsWith('0092')) return d.slice(2);          // 0092300… → 92300…
  if (d.startsWith('92') && d.length >= 12) return d;   // already 92300…
  if (d.startsWith('0') && d.length === 11) return '92' + d.slice(1); // 0300… → 92300…
  if (d.startsWith('3') && d.length === 10) return '92' + d;          // 300…  → 92300…
  return d.length >= 11 ? d : null;
}

/** Send the order-confirmation template with Confirm / Cancel quick-reply
 *  buttons. The template must already be APPROVED in Meta with a body that
 *  takes exactly these variables in this order:
 *    {{1}} customer first name
 *    {{2}} order number
 *    {{3}} order total (formatted, e.g. "PKR 5,336")
 *  and two quick-reply buttons. Meta returns the button PAYLOAD we set here
 *  when the customer taps, which is how the webhook knows which order. */
export async function sendOrderConfirmationTemplate(args: {
  phone: string | null | undefined;
  firstName: string;
  orderNumber: string;
  totalFormatted: string;
}): Promise<WaSendResult> {
  if (!isWhatsAppCloudConfigured()) return { ok: false, error: 'not_configured' };
  const to = toE164Digits(args.phone);
  if (!to) return { ok: false, error: 'no_phone' };

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_ACCESS_TOKEN!;
  const template = process.env.WHATSAPP_TEMPLATE_ORDER_CONFIRM || 'order_confirmation';
  const locale = process.env.WHATSAPP_TEMPLATE_LOCALE || 'en';

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template,
      language: { code: locale },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: args.firstName || 'there' },
            { type: 'text', text: args.orderNumber },
            { type: 'text', text: args.totalFormatted },
          ],
        },
        // Quick-reply payloads carry the order number back to our webhook.
        // Index order must match the template's button order in Meta.
        {
          type: 'button', sub_type: 'quick_reply', index: '0',
          parameters: [{ type: 'payload', payload: `CONFIRM:${args.orderNumber}` }],
        },
        {
          type: 'button', sub_type: 'quick_reply', index: '1',
          parameters: [{ type: 'payload', payload: `CANCEL:${args.orderNumber}` }],
        },
      ],
    },
  };

  try {
    const r = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const out = await r.json().catch(() => null) as null | {
      messages?: Array<{ id?: string }>;
      error?: { message?: string; code?: number; error_subcode?: number };
    };
    if (!r.ok || out?.error) {
      const msg = out?.error?.message || `HTTP ${r.status}`;
      // Loud but non-fatal: the order is already placed, and the email +
      // thank-you page still cover the customer.
      log.error('whatsapp_cloud.send_failed', {
        order: args.orderNumber, status: r.status, error: msg, code: out?.error?.code,
      });
      return { ok: false, error: msg };
    }
    const messageId = out?.messages?.[0]?.id;
    log.info('whatsapp_cloud.sent', { order: args.orderNumber, message_id: messageId });
    return { ok: true, messageId };
  } catch (err) {
    log.error('whatsapp_cloud.network_error', { order: args.orderNumber, error: (err as Error).message });
    return { ok: false, error: 'network_error' };
  }
}

/** Free-form text reply, only valid inside the 24-hour customer service
 *  window that a customer's own message opens (Meta rule). Used to
 *  acknowledge a Confirm/Cancel tap immediately. */
export async function sendTextMessage(args: {
  phone: string | null | undefined;
  text: string;
}): Promise<WaSendResult> {
  if (!isWhatsAppCloudConfigured()) return { ok: false, error: 'not_configured' };
  const to = toE164Digits(args.phone);
  if (!to) return { ok: false, error: 'no_phone' };
  try {
    const r = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp', to, type: 'text',
          text: { body: args.text, preview_url: false },
        }),
      },
    );
    if (!r.ok) {
      const out = await r.json().catch(() => null) as null | { error?: { message?: string } };
      return { ok: false, error: out?.error?.message || `HTTP ${r.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Parse a quick-reply payload back into an action + order number. Returns
 *  null for anything we didn't send (Meta echoes plain text replies too). */
export function parseButtonPayload(payload: string | undefined | null):
  { action: 'confirm' | 'cancel'; orderNumber: string } | null {
  if (!payload) return null;
  const m = /^(CONFIRM|CANCEL):([A-Za-z0-9-]+)$/.exec(payload.trim());
  if (!m) return null;
  return { action: m[1] === 'CONFIRM' ? 'confirm' : 'cancel', orderNumber: m[2] };
}
