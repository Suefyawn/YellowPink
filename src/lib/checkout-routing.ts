// Pure post-order routing helper. Lives outside `'use server'` so both the
// client component (CheckoutPage) and server callers can import it.

import type { PayMethod } from '@/types';

export function postOrderDestination(method: PayMethod, orderNumber: string): {
  kind: 'redirect_thank_you' | 'gateway_post';
  url: string;
} {
  if (method === 'jazzcash')  return { kind: 'gateway_post', url: '/api/payments/jazzcash' };
  if (method === 'easypaisa') return { kind: 'gateway_post', url: '/api/payments/easypaisa' };
  return { kind: 'redirect_thank_you', url: `/thank-you?order=${encodeURIComponent(orderNumber)}` };
}
