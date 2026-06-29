-- SEO trend persistence. refreshGoogle() already caches a GSC/GA4 *snapshot*
-- into analytics_cache (overwritten each run), so there was no way to answer
-- "is organic traffic / indexation improving over time?". This table stores one
-- row per day (GSC clicks/impressions/CTR/position, GA4 sessions incl. the
-- organic split, and the sitemap submitted-URL count as an indexation proxy),
-- upserted by the daily analytics-refresh cron. Idempotent per day, so late-
-- arriving GSC data (it lags ~2-3 days) backfills cleanly on re-runs.

create table if not exists public.seo_daily_metrics (
  day                  date primary key,
  gsc_clicks           integer,
  gsc_impressions      integer,
  gsc_ctr              double precision,
  gsc_position         double precision,
  ga4_sessions         integer,
  ga4_organic_sessions integer,
  ga4_users            integer,
  sitemap_submitted    integer,
  captured_at          timestamptz not null default now()
);

comment on table public.seo_daily_metrics is
  'Daily GSC + GA4 trend, upserted by the analytics-refresh cron (refreshSeoTrend). '
  'Lets the admin track organic clicks/impressions/position + sessions + indexation over time. '
  'Service-role only (no anon policies).';

-- Service-role writes (cron) + reads (admin widget via RPC). No anon policies.
alter table public.seo_daily_metrics enable row level security;

-- Read helper for the admin trend widget; admin-only via service role.
create or replace function public.seo_metrics_trend(p_days int default 90)
returns setof public.seo_daily_metrics
language sql
security definer
set search_path = public
as $$
  select *
  from public.seo_daily_metrics
  where day >= current_date - greatest(1, p_days)
  order by day;
$$;

comment on function public.seo_metrics_trend(int) is
  'Daily SEO metrics for the last p_days. Admin-only via service role; revoked from anon/authenticated.';

revoke all on function public.seo_metrics_trend(int) from anon, authenticated;
