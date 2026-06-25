-- ============================================================================
-- Remove the "Subscribe & Save" feature.
--
-- A true subscription needs a card on file to auto-bill; a cash-on-delivery
-- store can't do that. What this was — a reorder *reminder* plus a public,
-- reusable SUBSCRIBE10 coupon — over-promised ("subscribe & save") for near-zero
-- real value, with no order attribution and an undisclosed PKR 1,500 minimum.
-- Removed entirely; reorder nudges, if wanted later, belong in a plain
-- post-delivery email, not a subscription commitment.
--
-- Drops the table and retires the public discount code (kept as a row so the
-- two historical uses stay auditable, just deactivated).
-- ============================================================================

drop table if exists public.reorder_subscriptions;

update public.coupons set active = false where upper(code) = 'SUBSCRIBE10';
