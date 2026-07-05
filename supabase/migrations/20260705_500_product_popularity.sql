-- ============================================================================
-- Demand-driven product popularity.
--
-- `popularity_score` is refreshed daily by the popularity-refresh cron from a
-- trailing-window blend of storefront demand: PostHog view_item + add_to_cart
-- counts (human traffic, storefront only) plus real units sold from orders.
-- The homepage "Popular right now" rail (getBestsellers) orders by it, so the
-- rail reflects what shoppers are actually looking at and buying instead of a
-- purely manual flag. Manual is_bestseller still leads (owner override); this
-- score orders everything underneath it.
--
-- Default 0 so a fresh DB / a product with no signal simply sorts last; the
-- cron overwrites it each day (stale scores decay to 0 when demand dries up).
-- ============================================================================

alter table public.products
  add column if not exists popularity_score numeric not null default 0;

comment on column public.products.popularity_score is
  'Daily demand score (views + carts + sales, trailing window) set by the popularity-refresh cron. Orders the homepage popular rail. 0 = no recent demand.';

-- Ordering index for the popular rail / demand-sorted listings.
create index if not exists idx_products_popularity
  on public.products (popularity_score desc);
