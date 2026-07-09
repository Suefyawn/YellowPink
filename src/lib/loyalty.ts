// Loyalty + tier helpers shared by rewards page / checkout / admin.

import type { LoyaltyTier } from '@/types';

export const TIER_THRESHOLDS = {
  Silver: 1000,
  Gold:   5000,
} as const;

export function tierForLifetime(points: number): LoyaltyTier {
  if (points >= TIER_THRESHOLDS.Gold)   return 'Gold';
  if (points >= TIER_THRESHOLDS.Silver) return 'Silver';
  return 'Bronze';
}

export function nextTierTarget(points: number): { next: LoyaltyTier | null; needed: number } {
  if (points < TIER_THRESHOLDS.Silver) return { next: 'Silver', needed: TIER_THRESHOLDS.Silver - points };
  if (points < TIER_THRESHOLDS.Gold)   return { next: 'Gold',   needed: TIER_THRESHOLDS.Gold   - points };
  return { next: null, needed: 0 };
}

// Earn rules for the customer-facing "How to earn" list. Built from the LIVE
// admin settings (via CommerceConfig.loyaltyEarn) so changing a value in
// Settings → Loyalty is reflected here — the Postgres award triggers read the
// same site_settings rows, so display and awarding can't drift apart.
export function earnRules(earn: {
  welcome: number; review: number; referral: number; birthday: number; pointsPerPkr: number;
}): { reason: string; label: string; description: string }[] {
  return [
    { reason: 'welcome',        label: `+${earn.welcome} pts`,  description: 'Welcome bonus when you sign up' },
    { reason: 'order_delivered',label: `${Math.round(earn.pointsPerPkr * 100)} pts / PKR 100`, description: 'Earned when your order is marked delivered' },
    { reason: 'review_approved',label: `+${earn.review} pts`,   description: 'When a review you submit is approved' },
    { reason: 'referral_reward',label: `+${earn.referral} pts`, description: 'When someone you referred completes their first order' },
    { reason: 'birthday',       label: `+${earn.birthday} pts`, description: 'On your birthday (set your date of birth on your profile)' },
  ];
}

export const REASON_LABELS: Record<string, string> = {
  welcome:           'Welcome bonus',
  order_delivered:   'Order delivered',
  review_approved:   'Review approved',
  referral_reward:   'Referral reward',
  redemption:        'Points redeemed',
  birthday:          'Birthday bonus',
  manual:            'Manual adjustment',
  refund_reversal:   'Refund reversed',
};
