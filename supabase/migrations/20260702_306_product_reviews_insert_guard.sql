-- ============================================================================
-- SECURITY: constrain public/anon INSERTs into product_reviews.
--
-- The prior insert policy ("insert own review", migration 074) only checked
-- the author's user_id — it placed NO constraint on `approved`,
-- `verified_purchase` or `rating`. Because the anon key is public, anyone
-- hitting PostgREST directly could insert a review row with approved=true and
-- verified_purchase=true and an arbitrary rating; the rating-sync trigger
-- (migration 120) then folded that self-approved rating straight into the
-- product's public aggregate (products.rating / products.review_count).
--
-- This replaces that policy with one whose WITH CHECK forces every public
-- insert to land unapproved and unverified, with a valid 1–5 rating. Staff
-- flip `approved` (and may set `verified_purchase`) through the admin path,
-- which runs with the service role and bypasses RLS entirely, so moderation
-- and admin-seeded reviews are unaffected.
-- ============================================================================

-- Drop every historical name this insert policy has carried so the guard is
-- the single insert policy regardless of which migrations a database has seen.
drop policy if exists "insert own review"  on public.product_reviews;
drop policy if exists reviews_insert_any    on public.product_reviews;

create policy "public insert unapproved review" on public.product_reviews
  for insert to public
  with check (
        approved = false
    and verified_purchase = false
    and rating between 1 and 5
    and ( (select auth.uid()) = user_id or user_id is null )
  );
