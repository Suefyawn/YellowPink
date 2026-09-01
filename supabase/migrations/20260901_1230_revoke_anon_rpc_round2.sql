-- Lock down SECURITY DEFINER functions added (or recreated) since migration
-- 20260525_130_revoke_anon_rpc, per the convention documented there: every
-- function not called by the storefront via the anon client gets EXECUTE
-- revoked from anon + authenticated. Flagged by the Supabase security
-- advisor (anon_security_definer_function_executable) on 2026-09-01.
--
-- record_stock_change was revoked in migration 130 but has since been
-- recreated with a new signature (order refunds work), which restored the
-- default PUBLIC execute grant — hence it appears again here.
--
-- INTENTIONALLY NOT REVOKED (storefront calls these via the anon client):
--   place_order, search_products, search_posts, lookup_order, lookup_coupon,
--   validate_gift_card, validate_referral_code, check_referral_discount,
--   capture_abandoned_cart, restore_abandoned_cart, bump_review_helpful,
--   bump_redirect_hit, frequently_bought_with, has_purchased_product,
--   claim_guest_orders, generate_referral_code, active_automatic_discounts.

-- Server-only RPCs (called via supabaseAdmin() / cron routes)
REVOKE EXECUTE ON FUNCTION public.log_not_found(text, text, text, boolean)      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seo_metrics_trend(integer)                    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_product_scores(jsonb)                  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.web_vitals_summary(integer)                   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.web_vitals_worst_routes(text, integer, integer)
                                                                                FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_abandoned_cart_bells()                FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.push_fanout_notify()                          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_stock_change(
  uuid, uuid, integer, public.inventory_reason, uuid, uuid, text, text, text
)                                                                               FROM anon, authenticated;

-- Trigger functions (triggers run with the table owner's privileges, so the
-- revoke only closes the direct-RPC door)
REVOKE EXECUTE ON FUNCTION public.clawback_points_on_return()                   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.blog_posts_auto_assign_reviewer()             FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_reviewer_for_topic(text)               FROM anon, authenticated;

-- Also flagged by the advisor (function_search_path_mutable): pin the
-- reviewer-assignment helpers to the public schema so a caller's search_path
-- can't redirect their table references.
ALTER FUNCTION public.blog_posts_auto_assign_reviewer() SET search_path = public;
ALTER FUNCTION public.assign_reviewer_for_topic(text) SET search_path = public;
