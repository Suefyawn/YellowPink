// HMAC-signed order-confirmation tokens.
//
// Why this exists: 8 of the last 25 orders were cancelled, every one of them
// cash on delivery, every one cancelled by STAFF with no note, between 2 and
// 213 hours after the order was placed (90 days to 14 Sep 2026). The pattern is
// not customers refusing: it is staff unable to reach the customer to confirm,
// giving up, and cancelling. PKR 31,712 of cancellations plus PKR 4,998 of
// returns, against PKR 64,961 delivered — 42% of COD orders never complete.
//
// The order email already carries a "Confirm on WhatsApp" button, but pressing
// it only opens a chat: somebody on staff still has to read the message and
// record the yes by hand, which is the step that was not happening. A signed
// link lets the customer set orders.confirmed_at themselves, with no account,
// no app and no staff transcription.
//
// Token format: base64url(hmac256(secret, "confirm:" + order_number)).slice(0, 32)
//
// The "confirm:" prefix domain-separates these from unsubscribe tokens, which
// are generated with the same secret and the same truncation — without it a
// token minted for one purpose could be replayed against the other.
//
// SECRET resolution mirrors unsubscribe-token.ts so this ships without a new
// env var: ORDER_TOKEN_SECRET, else the service-role key, which is always set
// in production and never reaches the client.

import { createHmac, timingSafeEqual } from 'node:crypto';

function getSecret(): string {
  return process.env.ORDER_TOKEN_SECRET
      ?? process.env.SUPABASE_SERVICE_ROLE_KEY
      ?? 'dev-order-token-secret-do-not-use-in-prod';
}

/** Normalise the order number so a link still works when an email client or a
 *  customer retyping it changes the case or adds surrounding spaces. */
function canonical(orderNumber: string): string {
  return orderNumber.trim().toUpperCase();
}

export function makeOrderConfirmToken(orderNumber: string): string {
  const h = createHmac('sha256', getSecret())
    .update(`confirm:${canonical(orderNumber)}`)
    .digest('base64url');
  return h.slice(0, 32);
}

export function verifyOrderConfirmToken(orderNumber: string, token: string): boolean {
  if (!orderNumber || !token) return false;
  const expected = makeOrderConfirmToken(orderNumber);
  if (expected.length !== token.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

/** Absolute URL for the confirm page. Deliberately lands on a PAGE with a
 *  button rather than confirming on GET: inbox scanners and link-preview
 *  bots fetch every URL in an email, and a GET that mutates would mark orders
 *  confirmed that the customer never opened. The page's button POSTs. */
export function orderConfirmUrl(siteUrl: string, orderNumber: string): string {
  const o = canonical(orderNumber);
  return `${siteUrl.replace(/\/$/, '')}/order/confirm`
    + `?o=${encodeURIComponent(o)}&t=${makeOrderConfirmToken(o)}`;
}
