// Shared WhatsApp review-ask message. Single source for the per-order
// "Ask for review" button (admin order detail) and the Review asks queue
// (admin → Customers → Review asks), so the wording, the reward-points
// promise and the deep links can never drift between the two surfaces.
//
// Roman Urdu on purpose: this is how the store actually talks to customers
// on WhatsApp, and a personal-sounding ask converts far better than
// formal English.

import { SITE_URL } from '@/lib/seo';

export function buildReviewAskMessage(opts: {
  firstName?: string | null;
  orderNumber: string;
  /** Product slugs from the order, first two get review deep-links. */
  slugs: string[];
  /** Loyalty points per approved review (Settings → Loyalty); 0 hides the incentive. */
  rewardPoints: number;
}): string {
  const first = (opts.firstName ?? '').trim();
  const reviewLinks = opts.slugs.slice(0, 2).map(slug => `${SITE_URL}/product/${slug}#reviews`);
  return [
    `Assalam-o-Alaikum${first ? ` ${first}` : ''}!`,
    '',
    `Umeed hai aap ko apna Yellow Pink order (${opts.orderNumber}) pasand aaya!`,
    '',
    `Agar 2 minute nikaal kar chhota sa review chhor dein to hamare liye bohat madadgar hoga${opts.rewardPoints > 0 ? ` — aur review approve hote hi aap ko ${opts.rewardPoints} reward points milenge jo agle order par discount ban jaate hain` : ''}.`,
    '',
    ...(reviewLinks.length
      ? ['Review yahan chhor sakte hain:', ...reviewLinks]
      : [`Review yahan chhor sakte hain: ${SITE_URL}/shop`]),
    '',
    `Shukriya!, Team Yellow Pink`,
  ].join('\n');
}
