import 'server-only';
import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { sendReviewRewardEmail } from '@/lib/email';
import { brandPlusName } from '@/lib/product-display';
import { log } from '@/lib/logger';

// ============================================================================
// Review booster — issue a one-time discount code to a GUEST reviewer when
// their review is approved.
//
// Registered reviewers already earn loyalty points on approval (the
// reviews_award_points DB trigger, which keys on user_id). Guests (reviewer_
// email only, no account) earned nothing despite the review-request email
// promising a reward, so this closes that gap and never double-rewards a
// registered user.
//
// Best-effort throughout: a missing setting, a coupon collision, or a failed
// email must never break the admin "Approve" action. Idempotent: the reward is
// claimed atomically via product_reviews.reward_issued_at before the coupon is
// minted, so a re-approve or concurrent toggle can't issue two codes.
// ============================================================================

const CODE_PREFIX = 'THANKS';

function makeCode(): string {
  // 6 unambiguous base32-ish chars (no 0/O/1/I) → THANKS-XXXXXX.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${CODE_PREFIX}-${out}`;
}

interface RewardSettings { enabled: boolean; percent: number; days: number }

async function readSettings(): Promise<RewardSettings> {
  const { data } = await supabaseAdmin()
    .from('site_settings')
    .select('key, value')
    .in('key', ['review_reward_enabled', 'review_reward_percent', 'review_reward_days']);
  const map = new Map((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  const percent = Math.min(100, Math.max(1, Number(map.get('review_reward_percent') ?? '10') || 10));
  const days = Math.max(1, Number(map.get('review_reward_days') ?? '60') || 60);
  return { enabled: map.get('review_reward_enabled') === 'true', percent, days };
}

interface ReviewRow {
  id: string;
  approved: boolean | null;
  reviewer_email: string | null;
  user_id: string | null;
  reward_issued_at: string | null;
  products: { name: string | null; brand: string | null } | { name: string | null; brand: string | null }[] | null;
}

/** Issue the guest-review discount code for one review. Safe to call on every
 *  approval; returns silently when it shouldn't act (disabled, not a guest,
 *  no email, or already rewarded). Never throws. */
export async function issueReviewReward(reviewId: string): Promise<void> {
  try {
    const settings = await readSettings();
    if (!settings.enabled) return;

    const admin = supabaseAdmin();
    const { data: review } = await admin
      .from('product_reviews')
      .select('id, approved, reviewer_email, user_id, reward_issued_at, products(name, brand)')
      .eq('id', reviewId)
      .maybeSingle();
    const r = review as ReviewRow | null;
    if (!r || !r.approved) return;
    // Guests only: registered reviewers get loyalty points via the DB trigger.
    if (r.user_id) return;
    const email = (r.reviewer_email ?? '').trim().toLowerCase();
    if (!email || r.reward_issued_at) return;

    // Atomically claim the reward: only the update that flips reward_issued_at
    // from NULL proceeds, so concurrent/re-approvals can't mint two codes.
    const { data: claimed } = await admin
      .from('product_reviews')
      .update({ reward_issued_at: new Date().toISOString() })
      .eq('id', reviewId)
      .is('reward_issued_at', null)
      .select('id')
      .maybeSingle();
    if (!claimed) return; // someone else already claimed it

    const prod = Array.isArray(r.products) ? r.products[0] : r.products;
    const productName = prod?.name ? brandPlusName(prod.brand, prod.name) : undefined;
    const expiresAt = new Date(Date.now() + settings.days * 86_400_000).toISOString();

    // Mint a unique, single-use, email-locked percent coupon. Retry once on the
    // astronomically-rare code collision (unique index on coupons.code).
    let code = makeCode();
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error } = await admin.from('coupons').insert({
        code,
        type: 'percent',
        discount_type: 'percent',
        value: settings.percent,
        min_order: 0,
        max_uses: 1,
        usage_limit_per_user: 1,
        active: true,
        expires_at: expiresAt,
        email_restrictions: [email],
        description: 'Thank-you reward for an approved product review',
      });
      if (!error) break;
      if ((error as { code?: string }).code === '23505' && attempt === 0) { code = makeCode(); continue; }
      // Coupon insert failed for a non-collision reason: we've already stamped
      // reward_issued_at, so log and stop rather than loop or double-stamp.
      log.error('review_reward.coupon_failed', { reviewId, message: error.message });
      return;
    }

    await sendReviewRewardEmail({ email, code, percent: settings.percent, days: settings.days, productName });
    log.info('review_reward.issued', { reviewId, percent: settings.percent });
  } catch (err) {
    log.error('review_reward.failed', { reviewId, message: (err as Error).message });
  }
}
