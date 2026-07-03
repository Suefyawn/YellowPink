-- Public owner reply on customer reviews ("Response from Yellow Pink").
-- Rides the review row: the anon SELECT policy (approved = true) already
-- exposes exactly the approved reviews, so the reply needs no extra policy.
-- The WP-era brand_reply column was never written by anything (0 rows) and
-- never displayed; drop it so there is exactly one reply home.
alter table public.product_reviews
  add column if not exists owner_reply text,
  add column if not exists owner_reply_at timestamptz;

alter table public.product_reviews
  drop column if exists brand_reply;
