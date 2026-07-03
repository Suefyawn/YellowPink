-- Day/month bucketing in the store's market timezone (Asia/Karachi, fixed
-- UTC+5, no DST) instead of the database's UTC. The DB stores timestamptz in
-- UTC (correct and unchanged); these analytics functions previously grouped
-- by the UTC calendar day, so an order placed 00:00–05:00 PKT was charted on
-- "yesterday" and the dashboard's Today row started five hours late. Rolling
-- windows (analytics_kpis, now() - interval) are unaffected — only calendar
-- bucketing changes.

-- ─── Daily revenue / order count / AOV, PKT calendar days ──────────────────
create or replace function public.analytics_daily(
  p_days integer default 30
) returns table (
  day date,
  orders bigint,
  revenue numeric,
  aov numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select ((now() at time zone 'Asia/Karachi')::date - p_days) as start_day,
           (now() at time zone 'Asia/Karachi')::date as end_day
  ),
  series as (
    select generate_series((select start_day from bounds), (select end_day from bounds), '1 day')::date as day
  )
  select
    s.day,
    count(o.id)::bigint as orders,
    coalesce(sum(o.revenue), 0)::numeric as revenue,
    case when count(o.id) > 0 then (sum(o.revenue) / count(o.id))::numeric else 0::numeric end as aov
  from series s
  left join public.v_orders_revenue o
    on (o.created_at at time zone 'Asia/Karachi')::date = s.day
  group by s.day
  order by s.day;
$$;

-- ─── Monthly cohort retention, PKT calendar months ─────────────────────────
create or replace function public.analytics_cohort_retention(p_months integer default 6)
returns table (
  cohort_month date,
  month_offset integer,
  customers bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with first_order as (
    select coalesce(user_id::text, email) as cust_key,
           date_trunc('month', min(created_at at time zone 'Asia/Karachi'))::date as cohort_month
    from public.v_orders_revenue
    where coalesce(user_id::text, email) is not null
    group by 1
  ),
  recent as (
    select date_trunc('month', now() at time zone 'Asia/Karachi')::date - ((p_months - 1) || ' months')::interval as start_month
  )
  select
    f.cohort_month,
    (extract(year from (o.created_at at time zone 'Asia/Karachi'))::int * 12 + extract(month from (o.created_at at time zone 'Asia/Karachi'))::int)
      - (extract(year from f.cohort_month)::int * 12 + extract(month from f.cohort_month)::int) as month_offset,
    count(distinct f.cust_key)::bigint as customers
  from first_order f
  join public.v_orders_revenue o
    on coalesce(o.user_id::text, o.email) = f.cust_key
  where f.cohort_month >= (select start_month from recent)::date
  group by f.cohort_month,
           (extract(year from (o.created_at at time zone 'Asia/Karachi'))::int * 12 + extract(month from (o.created_at at time zone 'Asia/Karachi'))::int)
             - (extract(year from f.cohort_month)::int * 12 + extract(month from f.cohort_month)::int)
  order by f.cohort_month, month_offset;
$$;
