-- ============================================================================
-- Restore the storefront "read approved reviews" RLS policy.
--
-- Migration 073 dropped every product_reviews policy and recreated only
-- "insert own review". Production later regained a public SELECT policy for
-- approved reviews outside any migration, so PDPs render reviews there — but a
-- from-scratch build had no such policy and every product page showed zero
-- reviews. This recreates it (after 073, which is why it lives here rather
-- than in the pre-baseline migration). The pre-baseline functions and the
-- content_reviewers seed that used to live here moved to
-- 20260517_000a and 20260625_201a respectively, so they land before the
-- migrations that reference them.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.product_reviews'::regclass
      AND polname = 'read approved reviews'
  ) THEN
    CREATE POLICY "read approved reviews" ON public.product_reviews
      FOR SELECT USING (approved = true);
  END IF;
END $$;
