-- ============================================================================
-- Remove the stock-alert automation.
--
-- The store runs a mostly-dropship model, so shelf stock isn't a real signal:
--   • Low-stock alerts — the daily email digest to the owner — aren't useful
--     when stock counts are nominal. (Cron route + email sender deleted.)
--   • Back-in-stock notifications — customers dropping their email on an
--     out-of-stock PDP to be pinged when it returns — were purely
--     email-driven. Without that email the signup collects data we'd never
--     act on, so the whole feature is removed: storefront form, the cron that
--     sent the emails, the email sender, the feature flag, the RPC, and the
--     subscribers table.
--
-- Inventory *visibility* (admin inventory page, per-product reorder point,
-- "Only N left" / "Out of Stock" badges) is kept — that's not an alert.
-- ============================================================================

drop function if exists public.subscribe_back_in_stock(text, uuid, uuid);
drop table if exists public.stock_subscriptions;
delete from public.feature_flags where key = 'back_in_stock';
