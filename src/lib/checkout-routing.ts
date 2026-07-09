// Pure post-order routing helper. Lives outside `'use server'` so both the
// client component (CheckoutPage) and server callers can import it.

import type { PayMethod } from '@/types';

export function postOrderDestination(method: PayMethod, orderNumber: string): {
  kind: 'redirect_thank_you' | 'gateway_post';
  url: string;
} {
  if (method === 'jazzcash')  return { kind: 'gateway_post', url: '/api/payments/jazzcash' };
  // Card payments run on JazzCash's hosted page (it offers card entry there),
  // so they take the same initiator hop. Without this branch a "card" order
  // fell through to thank-you WITHOUT any gateway visit — the order sat in
  // payment_pending forever and the customer was never charged.
  if (method === 'card')      return { kind: 'gateway_post', url: '/api/payments/jazzcash' };
  if (method === 'easypaisa') return { kind: 'gateway_post', url: '/api/payments/easypaisa' };
  return { kind: 'redirect_thank_you', url: `/thank-you?order=${encodeURIComponent(orderNumber)}` };
}
