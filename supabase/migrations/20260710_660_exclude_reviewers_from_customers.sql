-- Medical reviewers are not customers.
--
-- Approving a reviewer provisions a passwordless auth user (so the doctor can
-- reach their /reviewer dashboard). auth user creation fires the profile
-- trigger, so every doctor also got a profiles row — and profiles is what all
-- the customer surfaces read. Result: doctors showed up in admin → Customers,
-- inflated the "New customers" dashboard KPI, and even collected the signup
-- welcome points.
--
-- Fix at the source: customer reads exclude any auth user linked from
-- content_reviewers (by auth_user_id, plus a belt-and-suspenders email match
-- for reviewers whose invite ran before the linkage landed).

-- 1. The Customers list RPC.
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE(id uuid, email text, first_name text, last_name text, phone text, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT u.id, u.email::text, p.first_name, p.last_name, p.phone, u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id NOT IN (
          SELECT cr.auth_user_id FROM public.content_reviewers cr
          WHERE cr.auth_user_id IS NOT NULL
        )
    AND lower(u.email::text) NOT IN (
          SELECT lower(cr.email) FROM public.content_reviewers cr
          WHERE cr.email IS NOT NULL AND cr.email <> ''
        )
  ORDER BY u.created_at DESC;
$function$;

-- 2. A reusable customer-only window over profiles for count/search surfaces
--    (dashboard "New customers" KPI, ⌘K palette customer search).
--    security_invoker so the caller's own rights apply; the admin reads it
--    with the service role, and anon gets no grant at all.
CREATE OR REPLACE VIEW public.customer_profiles
WITH (security_invoker = true) AS
  SELECT p.*
  FROM public.profiles p
  WHERE p.id NOT IN (
    SELECT cr.auth_user_id FROM public.content_reviewers cr
    WHERE cr.auth_user_id IS NOT NULL
  );

REVOKE ALL ON public.customer_profiles FROM anon, authenticated;
GRANT SELECT ON public.customer_profiles TO service_role;

-- 3. Take back the welcome points the signup trigger granted to doctors —
--    they are not in the loyalty programme. Idempotent: only touches accounts
--    that still hold exactly the untouched welcome grant (no spends, no other
--    earns), so a doctor who somehow shopped for real is left alone.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT la.user_id, la.points_balance
    FROM public.loyalty_accounts la
    JOIN public.content_reviewers cr ON cr.auth_user_id = la.user_id
    WHERE la.points_balance = la.lifetime_points          -- never spent
      AND NOT EXISTS (                                     -- only the welcome grant
        SELECT 1 FROM public.loyalty_ledger ll
        WHERE ll.user_id = la.user_id AND ll.reason <> 'welcome'
      )
  LOOP
    DELETE FROM public.loyalty_ledger WHERE user_id = r.user_id;
    DELETE FROM public.loyalty_accounts WHERE user_id = r.user_id;
  END LOOP;
END $$;
