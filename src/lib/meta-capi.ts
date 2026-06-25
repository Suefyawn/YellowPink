// Meta Conversions API (server-side) — sends the Purchase event straight from
// our server to Meta, so conversions are measured even when the browser Pixel
// is blocked, and (crucially) for gateway-paid orders where the client-side
// purchase event never fires (the shopper is on the gateway, not our site).
//
// Dedup: the event_id is the order number, matching the eventID we attach to
// the client Pixel's Purchase — Meta collapses the pair into one conversion.
//
// No-ops unless both NEXT_PUBLIC_META_PIXEL_ID and META_CAPI_ACCESS_TOKEN are
// set. Best-effort: it never throws, so it can't block the order flow.

import { createHash } from 'node:crypto';

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE; // optional, for Events Manager testing
const GRAPH_VERSION = 'v19.0';

// Meta requires SHA-256 of normalized values. Email: trimmed + lowercased.
// Phone: digits only (keep country code, drop +, spaces, dashes).
const hashEmail = (v: string) => createHash('sha256').update(v.trim().toLowerCase()).digest('hex');
const hashPhone = (v: string) => {
  const digits = v.replace(/[^0-9]/g, '');
  return digits ? createHash('sha256').update(digits).digest('hex') : null;
};

export interface MetaPurchaseInput {
  /** Order number — used as the dedup event_id. */
  orderNumber: string;
  value: number;
  currency?: string;
  email?: string | null;
  phone?: string | null;
  /** Product ids for catalog matching (optional). */
  contentIds?: string[];
  numItems?: number;
  eventSourceUrl?: string;
  clientIp?: string;
  userAgent?: string;
  /** Meta click-id / browser-id cookies (set by the Pixel). Passing them lifts
   *  the CAPI event's match quality and attribution accuracy substantially. */
  fbc?: string | null;
  fbp?: string | null;
}

/** Fire a server-side Purchase event to the Meta Conversions API. */
export async function sendMetaPurchaseEvent(input: MetaPurchaseInput): Promise<void> {
  if (!PIXEL_ID || !ACCESS_TOKEN) return;
  try {
    const user_data: Record<string, unknown> = {};
    if (input.email) user_data.em = [hashEmail(input.email)];
    if (input.phone) { const ph = hashPhone(input.phone); if (ph) user_data.ph = [ph]; }
    if (input.clientIp) user_data.client_ip_address = input.clientIp;
    if (input.userAgent) user_data.client_user_agent = input.userAgent;
    if (input.fbc) user_data.fbc = input.fbc;
    if (input.fbp) user_data.fbp = input.fbp;

    const custom_data: Record<string, unknown> = {
      currency: input.currency ?? 'PKR',
      value: input.value,
    };
    if (input.contentIds?.length) {
      custom_data.content_type = 'product';
      custom_data.content_ids = input.contentIds;
    }
    if (input.numItems != null) custom_data.num_items = input.numItems;

    const body = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          event_id: input.orderNumber,
          action_source: 'website',
          ...(input.eventSourceUrl ? { event_source_url: input.eventSourceUrl } : {}),
          user_data,
          custom_data,
        },
      ],
      ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
    };

    await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
  } catch {
    /* best-effort — never block the order flow on an analytics call */
  }
}
