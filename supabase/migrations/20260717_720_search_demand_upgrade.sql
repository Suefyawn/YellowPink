-- Search-demand report upgrade: two small backing tables.
--
-- 1. search_demand_ignores — terms staff hid from the report (junk, bot
--    noise, one-off typos). The report filters them out; a manager on the
--    page lists and un-hides them. Service-role access only.
--
-- 2. gsc_query_snapshots — one row per (day, query) from the daily Google
--    Search Console cache refresh. analytics_cache only keeps the latest
--    28-day aggregate, so there is no way to see whether a query is rising
--    or falling; this table accumulates history so the report can show
--    position/impression movers once a few days of data exist.

create table if not exists public.search_demand_ignores (
  term       text primary key,
  created_at timestamptz not null default now()
);
alter table public.search_demand_ignores enable row level security;
-- No policies: service-role (admin server actions) only.

create table if not exists public.gsc_query_snapshots (
  day         date not null,
  query       text not null,
  impressions integer not null default 0,
  clicks      integer not null default 0,
  position    numeric(6,2),
  ctr         numeric(6,4),
  primary key (day, query)
);
alter table public.gsc_query_snapshots enable row level security;
-- No policies: written by the daily cron, read by the admin report, both via
-- the service role.

create index if not exists gsc_query_snapshots_query_idx
  on public.gsc_query_snapshots (query, day);
