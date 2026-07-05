-- ============================================================================
-- Review booster: reward GUEST reviewers with a one-time discount code.
--
-- Registered reviewers already earn loyalty points on approval (the
-- reviews_award_points trigger, migration 20260520_030 — it needs new.user_id).
-- Guests who leave a review (reviewer_email only, no account) got nothing, even
-- though the review-request email promises a reward. This fills that gap: on
-- approval, a guest review with an email is issued a single-use, email-locked
-- percent coupon and emailed the code (see src/lib/review-reward.ts). It never
-- double-rewards a registered user (that path stays on loyalty points).
--
-- reward_issued_at is the idempotency guard: the app claims it atomically
-- (update ... where reward_issued_at is null) before creating the coupon, so a
-- re-approve or concurrent toggle can't mint two codes for one review.
-- ============================================================================

alter table public.product_reviews
  add column if not exists reward_issued_at timestamptz;

-- Config (admin-editable in Settings → Loyalty & rewards). Defaults chosen to
-- be live-but-modest; the owner can disable or retune. on conflict do nothing
-- so re-running never clobbers a value the owner has changed.
insert into public.site_settings (key, value) values
  ('review_reward_enabled', 'true'),
  ('review_reward_percent', '10'),
  ('review_reward_days',    '60')
on conflict (key) do nothing;
