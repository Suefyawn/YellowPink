-- ============================================================================
-- Split the demand signal so the homepage can show distinct, data-driven rails
-- and an automatic "Popular" badge.
--
-- `popularity_score` (migration 500) is a single blend of views+carts+sales.
-- That's fine for one "Popular" rail, but the owner wants two separate rails —
-- Best Sellers (what's actually bought) and Trending Now (what's getting
-- looked at / added right now) — plus an automatic badge. Those need the
-- component signals stored separately, refreshed nightly by the
-- popularity-refresh cron:
--   * units_sold  — real units sold over the trailing sales window
--   * trend_score — views*1 + carts*4 over the trailing view window
--   * is_popular  — set on the top-N products by the blended popularity_score,
--                   so a product tile can show a "Popular" badge that MEANS
--                   something (vs the manual is_bestseller owner override).
--
-- Append-only, idempotent. The cron writes all of these; defaults keep the
-- storefront correct until the first refresh runs.
-- ============================================================================

alter table public.products add column if not exists units_sold  numeric not null default 0;
alter table public.products add column if not exists trend_score numeric not null default 0;
alter table public.products add column if not exists is_popular  boolean not null default false;

-- Partial indexes: the rails only ever order published products by these.
create index if not exists idx_products_units_sold
  on public.products (units_sold desc) where status = 'published';
create index if not exists idx_products_trend_score
  on public.products (trend_score desc) where status = 'published';
