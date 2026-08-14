-- Migration 1150 — analytics depth for the Shopify-style overhaul.
--
-- Three read RPCs, all on the platform revenue rules (v_orders_revenue:
-- archived invisible; cancelled/payment_pending/payment_failed dropped;
-- refunded/returned are placed orders with revenue zeroed):
--
--   analytics_returning_split(p_days)  — per-day first-time vs returning
--     orders and revenue. "Returning" means the customer key had an earlier
--     order (all time) before this one. Shopify's core retention read.
--   analytics_sales_by_region(p_days)  — orders + revenue by city.
--   analytics_units_per_order(p_days)  — average units per order and average
--     distinct lines per order over the window.
--
-- Service-role only, like every other analytics_* RPC.

create or replace function public.analytics_returning_split(p_days integer default 30)
returns table (
  day date,
  new_orders bigint,
  new_revenue numeric,
  returning_orders bigint,
  returning_revenue numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with firsts as (
    select cust_key, min(created_at) as first_at
    from public.v_orders_revenue
    where cust_key is not null
    group by cust_key
  ),
  windowed as (
    select
      (o.created_at at time zone 'Asia/Karachi')::date as day,
      o.revenue,
      -- Unattributable orders (no key) count as first-time.
      (o.cust_key is not null and o.created_at > f.first_at) as is_returning
    from public.v_orders_revenue o
    left join firsts f on f.cust_key = o.cust_key
    where o.created_at >= now() - (p_days || ' days')::interval
  )
  select
    d.day,
    count(*) filter (where not w.is_returning)                    as new_orders,
    coalesce(sum(w.revenue) filter (where not w.is_returning), 0) as new_revenue,
    count(*) filter (where w.is_returning)                        as returning_orders,
    coalesce(sum(w.revenue) filter (where w.is_returning), 0)     as returning_revenue
  from windowed w
  join lateral (select w.day) d on true
  group by d.day
  order by d.day
$$;

revoke all on function public.analytics_returning_split(integer) from public, anon, authenticated;
grant execute on function public.analytics_returning_split(integer) to service_role;

create or replace function public.analytics_sales_by_region(p_days integer default 30)
returns table (
  city text,
  province text,
  orders bigint,
  revenue numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(nullif(trim(initcap(o2.city)), ''), 'Unknown') as city,
    coalesce(nullif(trim(o2.province), ''), '')             as province,
    count(*)::bigint                                        as orders,
    coalesce(sum(v.revenue), 0)                             as revenue
  from public.v_orders_revenue v
  join public.orders o2 on o2.id = v.id
  where v.created_at >= now() - (p_days || ' days')::interval
  group by 1, 2
  order by revenue desc, orders desc
$$;

revoke all on function public.analytics_sales_by_region(integer) from public, anon, authenticated;
grant execute on function public.analytics_sales_by_region(integer) to service_role;

create or replace function public.analytics_units_per_order(p_days integer default 30)
returns table (
  avg_units numeric,
  avg_lines numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with per_order as (
    select
      coalesce((select sum((it->>'qty')::int) from jsonb_array_elements(o2.items) it), 0) as units,
      coalesce(jsonb_array_length(o2.items), 0) as lines
    from public.v_orders_revenue v
    join public.orders o2 on o2.id = v.id
    where v.created_at >= now() - (p_days || ' days')::interval
  )
  select
    round(avg(units), 2) as avg_units,
    round(avg(lines), 2) as avg_lines
  from per_order
$$;

revoke all on function public.analytics_units_per_order(integer) from public, anon, authenticated;
grant execute on function public.analytics_units_per_order(integer) to service_role;
