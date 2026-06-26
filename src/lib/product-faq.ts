// Fallback FAQ for products that don't have an admin-authored one. These are
// store-level facts (authenticity, COD, delivery, returns), true for every
// product and deliberately free of any product-specific claim, so they're safe
// to show and to emit as FAQPage structured data on every PDP. Deliberately
// avoids quoting a free-shipping threshold, which is now an owner-toggleable
// setting; "calculated at checkout" stays accurate either way.

import { RETURNS_WINDOW_DAYS } from './commerce';

export interface ProductFaqItem { q: string; a: string }

/** Delivery-estimate window (working days) resolved from the live shipping
 *  defaults, so the delivery answer never hard-codes a day range. */
export interface ProductFaqOptions {
  estimatedDays?: { min: number; max: number } | null;
}

const deliveryRange = (d?: { min: number; max: number } | null) =>
  d ? `${d.min}–${d.max}` : 'a few';

const storeFactFaq = (opts?: ProductFaqOptions): ProductFaqItem[] => [
  {
    q: 'Is this product 100% authentic?',
    a: 'Yes. Every product at Yellow Pink is genuine, imported and sourced from authorised distributors, never counterfeit.',
  },
  {
    q: 'Do you deliver across Pakistan?',
    a: `Yes, we ship nationwide with cash on delivery (COD) available everywhere. Orders typically arrive in ${deliveryRange(opts?.estimatedDays)} working days.`,
  },
  {
    q: 'How is shipping charged?',
    a: 'Shipping is calculated at checkout based on your delivery city. Cash on delivery is available on every order.',
  },
  {
    q: 'Can I return it?',
    a: `Unopened items can be returned within ${RETURNS_WINDOW_DAYS} days. Message us on WhatsApp and we'll help arrange it.`,
  },
];

/** The FAQ to show + emit as schema for a product: the admin-authored list when
 *  present, otherwise the store-fact fallback so no PDP is left without one. */
export function effectiveProductFaq(
  faq: ReadonlyArray<ProductFaqItem> | null | undefined,
  opts?: ProductFaqOptions,
): ProductFaqItem[] {
  return faq && faq.length > 0 ? [...faq] : storeFactFaq(opts);
}
