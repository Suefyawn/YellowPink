-- Customer identity: user_id → email → PHONE. Checkout's email field is
-- optional (phone is required), so a guest who skips email had a NULL
-- customer key: count(distinct …) dropped them from "Unique customers"
-- entirely (reported: 3 orders / 3 people showed "2"), and the RFM/segment
-- views lumped every no-email guest into one anonymous bucket. Phone is the
-- reliable identity in a phone-first market; digits-only normalisation so
-- "+92 300…" and "0300…" formattings of the same number still differ only
-- if the numbers differ.
--
-- v_orders_revenue grows a cust_key column (single source of the identity
-- rule); every customer-keyed function now reads it instead of re-deriving.

create or replace view public.v_orders_revenue as
select
  o.id,
  o.created_at,
  case when o.status = 'refunded' then 0 else o.total end as revenue,
  o.user_id,
  lower(o.email) as email,
  o.status,
  coalesce(
    o.user_id::text,
    lower(o.email),
    nullif(regexp_replace(coalesce(o.phone, ''), '[^0-9]', '', 'g'), '')
  ) as cust_key
from public.orders o
where o.status not in ('cancelled','payment_pending','payment_failed');

-- ─── Top KPIs: unique customers + repeat rate on the shared key ─────────────
create or replace function public.analytics_kpis(p_days integer default 30)
returns table (
  total_orders         bigint,
  total_revenue        numeric,
  aov                  numeric,
  unique_customers     bigint,
  repeat_purchase_rate numeric,
  lifetime_orders      bigint,
  lifetime_revenue     numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with recent as (
    select * from public.v_orders_revenue
    where created_at >= now() - (p_days || ' days')::interval
  ),
  customers as (
    select cust_key, count(*) as order_count
    from public.v_orders_revenue
    where cust_key is not null
    group by 1
  )
  select
    (select count(*)::bigint from recent) as total_orders,
    coalesce((select sum(revenue) from recent), 0)::numeric as total_revenue,
    case when (select count(*) from recent) > 0 then ((select sum(revenue) from recent) / (select count(*) from recent))::numeric else 0::numeric end as aov,
    (select count(distinct cust_key) from recent)::bigint as unique_customers,
    case
      when (select count(*) from customers) > 0
      then ((select count(*) from customers where order_count > 1)::numeric / (select count(*) from customers)::numeric)
      else 0::numeric
    end as repeat_purchase_rate,
    (select count(*)::bigint from public.v_orders_revenue) as lifetime_orders,
    coalesce((select sum(revenue) from public.v_orders_revenue), 0)::numeric as lifetime_revenue;
$$;

-- ─── RFM segmentation on the shared key ─────────────────────────────────────
create or replace function public.analytics_rfm_segments()
returns table (
  segment text,
  customers bigint,
  total_revenue numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with per_customer as (
    select
      cust_key,
      max(created_at) as last_order_at,
      count(*) as freq,
      sum(revenue) as monetary
    from public.v_orders_revenue
    where created_at >= now() - interval '365 days'
      and cust_key is not null
    group by 1
  ),
  scored as (
    select
      cust_key,
      ntile(5) over (order by last_order_at desc) as r,
      ntile(5) over (order by freq desc) as f,
      ntile(5) over (order by monetary desc) as m,
      monetary
    from per_customer
  ),
  labelled as (
    select
      case
        when r = 1 and f = 1 and m = 1 then 'VIP'
        when r = 1 and f <= 2 then 'Loyal'
        when r = 1 then 'New / Recent'
        when r <= 2 and f <= 2 then 'Engaged'
        when r >= 4 and f <= 2 then 'At risk'
        when r = 5 then 'Lapsed'
        else 'Casual'
      end as segment,
      monetary
    from scored
  )
  select segment, count(*)::bigint as customers, coalesce(sum(monetary), 0)::numeric as total_revenue
  from labelled
  group by segment
  order by customers desc;
$$;

-- ─── Monthly cohort retention: PKT months (migration 340) + shared key ──────
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
    select cust_key,
           date_trunc('month', min(created_at at time zone 'Asia/Karachi'))::date as cohort_month
    from public.v_orders_revenue
    where cust_key is not null
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
    on o.cust_key = f.cust_key
  where f.cohort_month >= (select start_month from recent)::date
  group by f.cohort_month,
           (extract(year from (o.created_at at time zone 'Asia/Karachi'))::int * 12 + extract(month from (o.created_at at time zone 'Asia/Karachi'))::int)
             - (extract(year from f.cohort_month)::int * 12 + extract(month from f.cohort_month)::int)
  order by f.cohort_month, month_offset;
$$;

-- ─── Segments page view: same identity rule ─────────────────────────────────
create or replace view public.v_customer_segments as
with per_customer as (
  select
    coalesce(
      o.user_id::text,
      lower(o.email),
      nullif(regexp_replace(coalesce(o.phone, ''), '[^0-9]', '', 'g'), '')
    ) as cust_key,
    o.user_id,
    lower(o.email) as email,
    max(o.created_at) as last_order_at,
    min(o.created_at) as first_order_at,
    count(*)          as orders,
    sum(case when o.status = 'refunded' then 0 else o.total end) as revenue
  from public.orders o
  where o.status not in ('cancelled','payment_pending','payment_failed')
    and coalesce(o.user_id::text, o.email, nullif(regexp_replace(coalesce(o.phone, ''), '[^0-9]', '', 'g'), '')) is not null
  group by 1, 2, 3
)
select
  cust_key,
  user_id,
  email,
  orders,
  revenue,
  last_order_at,
  first_order_at,
  case
    when orders >= 5 and revenue >= 25000 then 'VIP'
    when orders >= 3                                                  then 'Loyal'
    when last_order_at >= now() - interval '30 days' and orders = 1   then 'New / Recent'
    when last_order_at >= now() - interval '90 days'                  then 'Engaged'
    when last_order_at <  now() - interval '180 days'                 then 'Lapsed'
    when last_order_at <  now() - interval '90 days'                  then 'At risk'
    else 'Casual'
  end as segment
from per_customer;
