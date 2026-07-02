-- ============================================================================
-- Baseline repair: objects that exist in production but were never created
-- by any migration file (pre-baseline history that the 20260517 squash
-- dropped). Discovered while rebuilding the database from migrations alone
-- during the 2026-07-02 audit: the chain breaks at 073 (decrement_stock),
-- 130 (get_admin_user/get_admin_users) and the 2026-06 blog content
-- migrations (content_reviewers rows), and the storefront renders no
-- reviews because the "read approved reviews" policy re-added in production
-- after 073 was never captured as a migration.
--
-- Everything here is a no-op against production (CREATE OR REPLACE with the
-- exact production definitions / guarded inserts); it exists so a fresh
-- database — dev branch, local stack, disaster recovery — matches prod.
-- ============================================================================

-- ── Functions (definitions read from production via pg_get_functiondef) ─────
-- Drop-first so databases carrying a divergent signature (different
-- parameter names) can be repaired; both drops are no-ops in production
-- immediately followed by identical re-creates in this same migration.
DROP FUNCTION IF EXISTS public.decrement_stock(uuid, integer);
DROP FUNCTION IF EXISTS public.get_admin_user(uuid);
DROP FUNCTION IF EXISTS public.get_admin_users();

CREATE OR REPLACE FUNCTION public.decrement_stock(pid uuid, amount integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE products SET stock = GREATEST(0, stock - amount) WHERE id = pid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_user(p_id uuid)
 RETURNS TABLE(id uuid, email text, first_name text, last_name text, phone text, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT u.id, u.email::text, p.first_name, p.last_name, p.phone, u.created_at
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = p_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_users()
 RETURNS TABLE(id uuid, email text, first_name text, last_name text, phone text, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT u.id, u.email::text, p.first_name, p.last_name, p.phone, u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
$function$;

-- Staff-only readers of auth.users: same posture migration 130 applied.
REVOKE ALL ON FUNCTION public.get_admin_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_admin_users() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO service_role;

-- ── Storefront review visibility ────────────────────────────────────────────
-- Migration 073 dropped every product_reviews policy and recreated only
-- "insert own review"; production later regained "read approved reviews"
-- outside a migration. Without it a fresh DB renders zero reviews on PDPs.
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

-- ── Editorial reviewer rows the 2026-06 blog migrations reference ───────────
-- blog_posts.reviewer_id has an FK to content_reviewers; the content
-- migrations assume these rows exist (they were created through the admin UI
-- in production). Guarded inserts keep fresh databases importable.
INSERT INTO content_reviewers (id, slug, name, credentials, specialty, is_default, active, sort_order, review_topics) VALUES
('67065511-cddf-4dc3-ab58-ff38027f8277','atiqa-zafar','Atiqa Zafar','D Pharmacy','Pharmacist',false,false,0,array['Medicines']),
('e9eb1e8a-fec8-43d0-8eee-77f6c5ac70b5','areej-saeed','Dr. Areej Saeed','MBBS','Medicine, Surgery, Radiology, Gastroenterology',true,true,0,array['Women''s Health','Men''s Health','Fertility','Bone & Joint','Skincare','Hair Care']),
('4cb664a8-3ec4-4b95-a5c8-9e4713bb046f','muneeba-zafar','Dr. Muneeba Zafar','MBBS FCPS','General Surgery',false,true,1,array['Women’s health','Supplements','Fertility']),
('0048c7cc-88db-45a0-a03d-c555c6c12612','ehsan-ali','Dr. Ehsan Ali','MBBS FCPS','Critical Care Medicine',false,true,2,array['Medicine']),
('9d886c5d-8e0e-430d-91f8-e6a3ceca87c8','ali-raza','Dr. Ali Raza','MBBS FCPS','Neurosciences',false,true,3,array['Brain Health and Nervous System'])
ON CONFLICT (id) DO NOTHING;
