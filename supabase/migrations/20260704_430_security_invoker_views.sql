-- ============================================================================
-- Security hardening: make the two reporting views SECURITY INVOKER.
--
-- Supabase's security advisor flags v_orders_revenue and v_customer_segments
-- as ERROR `security_definer_view`: a view without security_invoker runs with
-- the view OWNER's privileges, so it would bypass the querying role's RLS on
-- the underlying `orders` table if ever exposed to anon/authenticated.
--
-- Today both are read only through the service-role admin client (staff-gated
-- Analytics / Segments pages), which bypasses RLS regardless — so this is a
-- defence-in-depth change with no behavioural effect on those pages. With
-- security_invoker on, any accidental anon/authenticated read now correctly
-- returns nothing (orders RLS blocks them) instead of leaking order data.
--
-- No DB object depends on either view (verified), and neither is queried by
-- the anon client, so flipping the flag is safe.
-- ============================================================================

alter view public.v_orders_revenue    set (security_invoker = true);
alter view public.v_customer_segments set (security_invoker = true);

-- Housekeeping: drop the leftover one-off backup tables from the 2026-07-02
-- fix waves (blog house-style, description backfill, image rehost, product
-- data). Each is a partial dated snapshot of only the rows a batch touched,
-- taken as insurance while that batch shipped. All of it merged and was
-- regression-verified days ago, so the snapshots have served their purpose;
-- they only linger as INFO `rls_enabled_no_policy` advisor noise now.
drop table if exists public._audit_blog_backup_20260702;
drop table if exists public._audit_blog_style_backup_20260702;
drop table if exists public._audit_desc_backup_20260702;
drop table if exists public._audit_image_backup_20260702;
drop table if exists public._audit_product_backup_20260702;
