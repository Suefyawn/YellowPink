-- Migration 1160 — close PII exposure on v_customer_segments (applied to
-- production 15 Aug 2026, found during the segments-builder test pass).
--
-- Migration 430 set security_invoker=true on every view; migration 860
-- RESTATED v_customer_segments with CREATE OR REPLACE VIEW, which resets
-- reloptions — silently turning it back into an owner-rights view. Combined
-- with the blanket anon SELECT grant from the early schema, the public anon
-- key could read every customer's email/phone key, order count, revenue and
-- last-order date.
--
-- Rule for future migrations: any CREATE OR REPLACE VIEW must re-assert
-- security_invoker in the same migration — replace silently drops it.

alter view public.v_customer_segments set (security_invoker = true);

-- Belt and braces: nothing client-side queries these views (the admin pages
-- use the service role; analytics RPCs are SECURITY DEFINER), so drop the
-- pointless public grants entirely.
revoke all on public.v_customer_segments from anon, authenticated;
revoke all on public.v_orders_revenue from anon, authenticated;
