-- Round 3 of the SECURITY DEFINER lock-down (see 20260525_130 and
-- 20260901_1230 for the convention).
--
-- Round 2 revoked EXECUTE from anon and authenticated, but Postgres had also
-- granted EXECUTE to PUBLIC when each function was created, and anon /
-- authenticated are members of PUBLIC. pg_proc.proacl on 2026-09-04 still
-- showed "=X/postgres" on every function below, so the Supabase security
-- advisor (anon_security_definer_function_executable) kept flagging all of
-- them: the round-2 revoke closed nothing. This revokes the PUBLIC grant,
-- which is what actually removes the RPC endpoint from the anon key.
--
-- service_role keeps its explicit grant, so supabaseAdmin() / cron callers
-- and the triggers (which run as the table owner) are unaffected.

-- Server-only RPCs (called via supabaseAdmin() / cron routes)
REVOKE EXECUTE ON FUNCTION public.log_not_found(text, text, text, boolean)      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seo_metrics_trend(integer)                    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_product_scores(jsonb)                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.web_vitals_summary(integer)                   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.web_vitals_worst_routes(text, integer, integer)
                                                                                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_abandoned_cart_bells()                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.push_fanout_notify()                          FROM PUBLIC;

-- Trigger functions: nothing calls these directly. generate_referral_code
-- (profiles_generate_referral_code trigger) was listed in round 2 as a
-- storefront RPC, but no code path calls it via .rpc() — it only ever fires
-- from the trigger, so the explicit anon/authenticated grants go too.
REVOKE EXECUTE ON FUNCTION public.clawback_points_on_return()                   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code()                      FROM PUBLIC, anon, authenticated;

-- bump_redirect_hit: created for a storefront call that never shipped (no
-- .rpc('bump_redirect_hit') anywhere in src/; proxy.ts resolves redirects
-- server-side). Close the anonymous door; service_role can still bump it.
REVOKE EXECUTE ON FUNCTION public.bump_redirect_hit(text)                       FROM PUBLIC, anon, authenticated;

-- claim_guest_orders is legitimately called by a signed-in shopper from the
-- account page (it reads auth.uid()); keep the authenticated grant, drop the
-- PUBLIC one so the anon key cannot reach it.
REVOKE EXECUTE ON FUNCTION public.claim_guest_orders()                          FROM PUBLIC;
