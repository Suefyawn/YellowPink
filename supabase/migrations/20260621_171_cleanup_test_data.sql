-- ============================================================================
-- One-off cleanup of launch/test data (owner-approved scope: test orders + test
-- newsletter subs; seeded product reviews KEPT as social proof).
--   • Orders: 2 explicit test (TestOrder / QA / *.test email) + 25 placed on the
--     owner's dev phone +923000688871 (Jan–Feb 2025 launch testing, dummy emails
--     xyz@/abc@/soon@…). The 26 real customer orders are untouched.
--   • FKs to orders are all CASCADE or SET NULL, so child rows clean up safely.
--   • Newsletter: the 2 owner test subscriptions.
-- product_reviews are intentionally left in place.
-- ============================================================================

delete from orders
where last_name = 'TestOrder'
   or first_name = 'QA'
   or email ilike '%.test'
   or replace(phone, ' ', '') like '%3000688871%';

delete from newsletter_subscribers
where email in ('sooviaan@gmail.com', 'jetnine.inc@gmail.com');
