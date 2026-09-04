-- update_product_scores was created in production (popularity-refresh cron,
-- src/app/api/cron/popularity-refresh/route.ts) without a migration, so the
-- from-scratch CI chain had no such function when 20260901_1230 tried to
-- revoke it — the "Migrations from scratch" job has been red since 1 Sep.
-- This is the production definition verbatim (pg_get_functiondef,
-- 2026-09-04), filed just ahead of that revoke so the chain reproduces.
-- CREATE OR REPLACE makes it a no-op against production.
--
-- Server-only: the cron calls it through supabaseAdmin(). Lock it down here
-- per the convention in 20260525_130 (the later rounds repeat the revoke,
-- harmlessly).

CREATE OR REPLACE FUNCTION public.update_product_scores(p_scores jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  update products p set
    popularity_score = r.score,
    trend_score      = r.trend,
    units_sold       = r.units,
    sales_score      = r.sales_score,
    is_popular       = r.is_popular
  from jsonb_to_recordset(p_scores)
    as r(id uuid, score numeric, trend numeric, units numeric, sales_score numeric, is_popular boolean)
  where p.id = r.id;
  get diagnostics n = row_count;
  update products set
    popularity_score = 0, trend_score = 0, units_sold = 0, sales_score = 0, is_popular = false
  where (popularity_score <> 0 or trend_score <> 0 or units_sold <> 0 or sales_score <> 0 or is_popular)
    and id not in (select (e->>'id')::uuid from jsonb_array_elements(p_scores) e);
  return n;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.update_product_scores(jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.update_product_scores(jsonb) TO service_role;
