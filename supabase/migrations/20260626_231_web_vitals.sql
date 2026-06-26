-- ============================================================================
-- Web Vitals — native Core Web Vitals capture so the admin dashboard can show
-- real field performance (LCP / INP / CLS …) in-app instead of sending the
-- owner off to vercel.com.
--
-- Vercel Speed Insights & Web Analytics have no public query API, so we can't
-- pull their numbers into our own UI. Instead the storefront's
-- WebVitalsReporter beacons every metric (consent-gated) to /api/vitals, which
-- inserts here. The Analytics page reads aggregates via SECURITY DEFINER RPCs.
--
-- Privacy: we store the metric, its value, Google's good/ni/poor rating, the
-- route (pathname only — no query string), a coarse mobile/desktop bucket and
-- the connection type. No PII, no per-user id. Mirrors the contact_messages
-- RLS shape: writes happen through the service role in the API route, and with
-- NO anon policies at all the table is unreadable to the public.
-- ============================================================================

create table if not exists public.web_vitals (
  id            uuid primary key default gen_random_uuid(),
  -- LCP, INP, CLS, FCP, TTFB (Next.js also emits Next-* custom metrics; we
  -- only persist the standard Core Web Vitals set, filtered in the route).
  metric        text not null,
  -- Raw metric value. ms for LCP/INP/FCP/TTFB; unitless ratio (×1000 NOT
  -- applied) for CLS. Stored as-is; the RPC formats per metric.
  value         double precision not null,
  rating        text check (rating in ('good','needs-improvement','poor')),
  -- Pathname only (query string stripped client-side) so routes group cleanly
  -- and we never persist tokens/emails that ride in query params.
  route         text,
  device        text check (device in ('mobile','desktop')),
  -- effectiveType from the Network Information API (4g/3g/…), best-effort.
  connection    text,
  created_at    timestamptz not null default now()
);

comment on table public.web_vitals is
  'Core Web Vitals field samples beaconed from the storefront (consent-gated). '
  'Service role writes via /api/vitals; aggregated by web_vitals_* RPCs for the '
  'admin Analytics page. No anon policies => unreadable to the public.';

-- Hot path for the aggregation RPCs: filter by window (created_at) then group
-- by metric, and a second one for the per-route breakdown.
create index if not exists web_vitals_metric_created_idx
  on public.web_vitals (metric, created_at desc);
create index if not exists web_vitals_created_idx
  on public.web_vitals (created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Enable RLS and add NO policies. anon/authenticated therefore can neither
-- read nor write directly; the API route uses the service role (bypasses RLS)
-- to insert, and the admin widgets call the RPCs below (security definer).
alter table public.web_vitals enable row level security;

-- ── Aggregation: p75 + rating split per metric over a window ─────────────────
-- Google reports CWV at the 75th percentile, so that's what we surface. One
-- row per metric with p75, the good/ni/poor counts and the sample size.
create or replace function public.web_vitals_summary(p_days int default 30)
returns table (
  metric        text,
  p75           double precision,
  samples       bigint,
  good          bigint,
  needs_improvement bigint,
  poor          bigint
)
language sql
security definer
set search_path = public
as $$
  select
    v.metric,
    percentile_cont(0.75) within group (order by v.value)        as p75,
    count(*)                                                       as samples,
    count(*) filter (where v.rating = 'good')                     as good,
    count(*) filter (where v.rating = 'needs-improvement')        as needs_improvement,
    count(*) filter (where v.rating = 'poor')                     as poor
  from public.web_vitals v
  where v.created_at >= now() - make_interval(days => greatest(1, p_days))
  group by v.metric;
$$;

comment on function public.web_vitals_summary(int) is
  'Per-metric p75 + good/ni/poor counts over the last p_days. Admin-only via '
  'service role; revoked from anon/authenticated.';

-- ── Worst routes for a given metric (where to go fix first) ──────────────────
create or replace function public.web_vitals_worst_routes(
  p_metric text,
  p_days   int default 30,
  p_limit  int default 5
)
returns table (
  route     text,
  p75       double precision,
  samples   bigint
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(v.route, '(unknown)')                          as route,
    percentile_cont(0.75) within group (order by v.value)   as p75,
    count(*)                                                 as samples
  from public.web_vitals v
  where v.metric = p_metric
    and v.created_at >= now() - make_interval(days => greatest(1, p_days))
  group by coalesce(v.route, '(unknown)')
  -- Only routes with enough samples to be meaningful, worst (highest p75) first.
  having count(*) >= 5
  order by percentile_cont(0.75) within group (order by v.value) desc
  limit greatest(1, p_limit);
$$;

comment on function public.web_vitals_worst_routes(text,int,int) is
  'Top p_limit routes by p75 for a metric over p_days (min 5 samples). '
  'Admin-only via service role; revoked from anon/authenticated.';

-- Lock the RPCs down to the service role, same as the other analytics_* RPCs.
revoke all on function public.web_vitals_summary(int) from anon, authenticated;
revoke all on function public.web_vitals_worst_routes(text,int,int) from anon, authenticated;
