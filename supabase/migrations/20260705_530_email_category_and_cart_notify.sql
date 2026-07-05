-- ============================================================================
-- Email log clarity + abandoned-cart owner notifications.
--
-- Three related asks from the owner:
--   1. "I'd like to see what emails are sent, in the email logs too." — the log
--      only carried `kind` (transactional / batch), which says HOW an email is
--      throttled, not WHAT it is. Add a human `category` (Order confirmation,
--      Shipped, Abandoned cart, Newsletter, …) that email.ts now sets on every
--      send, and backfill existing rows from their subject line.
--   2. "We should be notified about the cart abandonment emails too, that it
--      was sent." — allow a new admin_notifications kind `abandoned_cart` so the
--      cron can drop a notification into the bell feed after a run that sent
--      reminders.
--
-- Append-only, forward-fix. Safe to re-run (idempotent guards throughout).
-- ============================================================================

-- 1. Human-readable category on the email log ────────────────────────────────
alter table public.email_log add column if not exists category text;

-- Backfill existing rows from their subject line (best-effort, patterns mirror
-- the subject strings in src/lib/email.ts). New rows get the category directly.
update public.email_log set category = case
  when subject ilike 'New order %'                      then 'Order alert'
  when subject ilike 'New message from %'               then 'Contact message'
  when subject ilike 'Order % confirmed%'               then 'Order confirmation'
  when subject ilike 'Payment received%'                then 'Payment received'
  when subject ilike 'Shipped,%'                        then 'Shipped'
  when subject ilike 'Delivered,%'                      then 'Delivered'
  when subject ilike 'Cancelled,%'                      then 'Cancelled'
  when subject ilike 'Welcome to Yellow Pink, your fortnightly%' then 'Newsletter welcome'
  when subject ilike 'Welcome to Yellow Pink%'          then 'Welcome'
  when subject ilike 'Yellow Pink admin access%'        then 'Staff access'
  when subject ilike 'Reviewer application,%'           then 'Reviewer application'
  when subject ilike 'Your Yellow Pink reviewer access%' then 'Reviewer approved'
  when subject ilike 'Complete your Yellow Pink reviewer%' then 'Reviewer profile'
  when subject ilike '%cart%expire%'                    then 'Abandoned cart'
  when subject ilike 'Still thinking it over%'          then 'Abandoned cart'
  when subject ilike 'You left some things in your cart%' then 'Abandoned cart'
  when subject ilike 'How was your order %'             then 'Review request'
  when subject ilike 'Your % thank-you code%'           then 'Review reward'
  when subject ilike 'Action needed, % payment%'        then 'Stuck payments'
  when subject ilike '% new broken link%'               then 'Broken links'
  else null
end
where category is null;

-- 2. New admin_notifications kind for abandoned-cart runs ─────────────────────
alter table public.admin_notifications drop constraint if exists admin_notifications_kind_check;
alter table public.admin_notifications add constraint admin_notifications_kind_check
  check (kind = any (array[
    'new_order', 'low_stock', 'payment_failed', 'return_request',
    'new_review', 'staff_added', 'sentry_issue', 'posthog_spike',
    'posthog_drop', 'new_message', 'abandoned_cart'
  ]));
