-- ============================================================================
-- Pre-baseline functions that production carries but no migration created.
-- The 20260517_000 baseline squash dropped their DDL, yet later migrations
-- reference them: 073 ALTERs decrement_stock + notify_order_confirmation, and
-- 130 REVOKEs on get_admin_user / get_admin_users. On the production database
-- these already existed (created before the squash), so the chain applied
-- cleanly there — but a from-scratch build (dev branch, local stack, disaster
-- recovery) broke at 073. This migration sorts immediately after the baseline
-- and before 073/130 so those objects exist when they're first referenced.
--
-- Definitions match production (read via pg_get_functiondef). notify_order_
-- confirmation is a no-op stub: production's original webhook-posting body was
-- dropped by 20260525_092, so a fresh build only needs it to exist long enough
-- to satisfy 073's ALTER before 092 drops it again.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.decrement_stock(pid uuid, amount integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE products SET stock = GREATEST(0, stock - amount) WHERE id = pid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_order_confirmation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN NEW;
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
