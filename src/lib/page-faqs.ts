// FAQ content keyed by CMS page slug. When the merchant publishes a CMS page
// (via WordPress import or admin) whose slug matches one of these keys, the
// page route layers in FAQPage JSON-LD so the questions can appear as
// expandable cards in Google search results.
//
// Keep the questions and answers in sync with the human-readable copy on the
// CMS page itself. Google's FAQ guidelines require the JSON-LD answer text to
// be visible on the rendered page — paste-equivalents only, no exclusive content.
//
// To add coverage for a new page, append a new key here and ensure the same
// Q/A pairs are present in the CMS page body.

import { FREE_SHIPPING_THRESHOLD, RETURNS_WINDOW_DAYS, formatPkr, type CommerceConfig } from './commerce';

export interface FaqEntry {
  question: string;
  answer: string;
}

/** Live policy figures, so the FAQ answers (and the FAQPage JSON-LD built from
 *  them) track the owner's settings instead of stating a hard-coded number. */
export interface FaqPolicy {
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
}

const freeShippingAnswer = (p: FaqPolicy) =>
  p.freeShippingEnabled
    ? `Free shipping is automatically applied to orders over ${formatPkr(p.freeShippingThreshold)} nationwide. Below that threshold, a flat shipping fee is calculated at checkout based on your delivery city.`
    : 'A flat shipping fee is calculated at checkout based on your delivery city.';

const returnsWindowAnswer = () =>
  `You can request a return within ${RETURNS_WINDOW_DAYS} days of delivery for unopened, unused items in their original packaging. Opened or used items are not eligible unless they arrived damaged or defective.`;

const buildFaqs = (p: FaqPolicy): Record<string, FaqEntry[]> => ({
  shipping: [
    {
      question: 'How long does delivery take in Pakistan?',
      answer:
        'Karachi, Lahore, and Islamabad orders typically arrive in 2 to 3 working days. Other major cities take 3 to 4 days, and remote areas can take up to 5 to 7 working days. Orders confirmed before 2 PM ship the same day.',
    },
    {
      question: 'Do you offer cash on delivery (COD)?',
      answer:
        'Yes — cash on delivery is available across Pakistan. You pay the courier at the doorstep when your order arrives. No advance payment required for COD orders.',
    },
    {
      question: 'When does free shipping apply?',
      answer: freeShippingAnswer(p),
    },
    {
      question: 'Which courier services do you use?',
      answer:
        'We dispatch via TCS, Leopards, M&P, and BlueEx depending on your delivery zone. You receive a tracking number by email and SMS as soon as your parcel is collected.',
    },
    {
      question: 'Can I change my delivery address after placing an order?',
      answer:
        'Yes, if your order has not yet been dispatched. Contact us through the help page with your order number and the corrected address; we will update it before the parcel ships.',
    },
  ],
  returns: [
    {
      question: 'What is your return window?',
      answer: returnsWindowAnswer(),
    },
    {
      question: 'How do I request a return?',
      answer:
        'Sign in to your account, open the relevant order, and tap "Request return". A confirmation email is sent once our team approves the request, along with pickup or drop-off instructions.',
    },
    {
      question: 'Who pays for return shipping?',
      answer:
        'For damaged, defective, or wrong-item shipments, we cover the return courier fee. For other reasons (changed mind, wrong shade), the customer arranges the return at their own cost.',
    },
    {
      question: 'How are refunds issued?',
      answer:
        'Refunds are issued as store credit by default, usable on any future order. If you prefer a cash refund for a COD order, we deduct the COD courier fee from the refunded amount and arrange a bank transfer within 5 working days of receiving the returned item.',
    },
  ],
  faq: [
    {
      question: 'Are your products authentic?',
      answer:
        'Yes — every product we list is sourced from authorised distributors or direct from international brand websites. We do not stock counterfeits, and serial-coded items can be verified on the brand website.',
    },
    {
      question: 'How do I track my order?',
      answer:
        'Open the Track Order page and enter your order number along with the email or phone number used at checkout. You will see the live courier status plus a link directly to the courier tracking page.',
    },
    {
      question: 'Do you ship outside Pakistan?',
      answer:
        'Not at the moment. We ship only within Pakistan, with cash-on-delivery available in all major cities and online payment via JazzCash and Easypaisa.',
    },
    {
      question: 'How can I contact customer support?',
      answer:
        'Reach us via the Contact page or by replying to your order confirmation email. We respond to most enquiries within one working day, Monday to Saturday.',
    },
  ],
});

/** FAQ entries for a CMS page slug, with policy figures (free-shipping
 *  threshold, returns window) resolved from the live commerce config. Pass
 *  `parseCommerceConfig(settings)`; omit it and it falls back to the defaults. */
export function getPageFaq(slug: string, config?: Pick<CommerceConfig, 'freeShippingEnabled' | 'freeShippingThreshold'>): FaqEntry[] | null {
  const policy: FaqPolicy = {
    freeShippingEnabled: config?.freeShippingEnabled ?? true,
    freeShippingThreshold: config?.freeShippingThreshold ?? FREE_SHIPPING_THRESHOLD,
  };
  return buildFaqs(policy)[slug] ?? null;
}
