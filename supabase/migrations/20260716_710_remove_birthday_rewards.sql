-- Remove the birthday-rewards feature (owner decision, 2026-07-16).
--
-- Migration 20260709_640 shipped award_birthday_points() assuming a
-- profiles.dob column that was never created, so the function failed on every
-- daily cron run since July 10 — and the profile page's save payload included
-- the missing column, breaking ALL customer profile saves. Rather than add
-- the column, the owner chose to drop the feature: the cron route, the DOB
-- field, the loyalty earn rule and the admin setting are removed in the same
-- change as this migration.
--
-- No loyalty_ledger rows with reason='birthday' exist (the function never
-- completed successfully), so nothing in the ledger needs migrating.

drop function if exists public.award_birthday_points();

delete from public.site_settings where key = 'loyalty_birthday_points';
