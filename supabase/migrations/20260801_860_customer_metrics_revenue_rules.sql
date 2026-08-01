-- Migration 860 — customer metrics and top products adopt the platform
-- revenue rules (2026-08-01 cross-surface audit).
--
-- Four surfaces still computed money their own way:
--   • get_customer_order_stats / get_guest_customers (Customers admin, CSV
--     export) and v_customer_segments zeroed only `refunded` — a customer
--     whose parcels bounced (`returned`) looked like a top spender — and
--     none of the three excluded archived orders.
--   • analytics_top_products recomputed item revenue from raw items for
--     every order in v_orders_revenue, so refunded/returned orders (kept in
--     the view as placed orders with revenue zeroed) contributed their items
--     at FULL price to the "top products by revenue" table.
--
-- Rules now everywhere: archived orders invisible; cancelled /
-- payment_failed / payment_pending dropped; refunded / returned count as
-- placed orders with zero revenue; top-products only ranks orders that
-- actually earned revenue.

create or replace function public.get_customer_order_stats()
returns table (
  user_id       uuid,
  order_count   bigint,
  total_spent   numeric,
  last_order_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  with accounts as (
    select u.id,
           lower(u.email) as email,
           nullif(regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g'), '') as phone
    from auth.users u
    left join public.profiles p on p.id = u.id
  ),
  attributed as (
    select distinct on (o.id)
      a.id as acct_id, o.total, o.status, o.created_at
    from public.orders o
    join accounts a
      on  o.user_id = a.id
      or (o.user_id is null and a.email is not null and lower(o.email) = a.email)
      or (o.user_id is null and a.phone is not null
          and nullif(regexp_replace(coalesce(o.phone, ''), '[^0-9]', '', 'g'), '') = a.phone)
    where o.status not in ('cancelled','payment_pending','payment_failed')
      and o.archived_at is null
    order by o.id,
      case
        when o.user_id = a.id then 1
        when a.email is not null and lower(o.email) = a.email then 2
        else 3
      end
  )
  select
    acct_id                                                                          as user_id,
    count(*)::bigint                                                                 as order_count,
    coalesce(sum(case when status in ('refunded','returned') then 0 else total end), 0) as total_spent,
    max(created_at)                                                                  as last_order_at
  from attributed
  group by acct_id;
$$;

revoke all on function public.get_customer_order_stats() from public, anon, authenticated;
grant execute on function public.get_customer_order_stats() to service_role;

create or replace function public.get_guest_customers()
returns table (
  guest_key      text,
  email          text,
  first_name     text,
  last_name      text,
  phone          text,
  order_count    bigint,
  total_spent    numeric,
  last_order_at  timestamptz,
  first_order_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  with accounts as (
    select lower(u.email) as email,
           nullif(regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g'), '') as phone
    from auth.users u
    left join public.profiles p on p.id = u.id
  ),
  guest_orders as (
    select
      o.*,
      coalesce(nullif(lower(o.email), ''), 'phone:' || o.phone) as gkey
    from public.orders o
    where o.user_id is null
      and o.status not in ('cancelled','payment_pending','payment_failed')
      and o.archived_at is null
      and not exists (
        select 1 from accounts a
        where (a.email is not null and lower(o.email) = a.email)
           or (a.phone is not null
               and nullif(regexp_replace(coalesce(o.phone, ''), '[^0-9]', '', 'g'), '') = a.phone)
      )
  )
  select
    gkey                                                          as guest_key,
    (array_agg(email      order by created_at desc))[1]          as email,
    (array_agg(first_name order by created_at desc))[1]          as first_name,
    (array_agg(last_name  order by created_at desc))[1]          as last_name,
    (array_agg(phone      order by created_at desc))[1]          as phone,
    count(*)                                                      as order_count,
    coalesce(sum(case when status in ('refunded','returned') then 0 else total end), 0) as total_spent,
    max(created_at)                                              as last_order_at,
    min(created_at)                                              as first_order_at
  from guest_orders
  group by gkey;
$$;

revoke all on function public.get_guest_customers() from public, anon, authenticated;
grant execute on function public.get_guest_customers() to service_role;

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
    sum(case when o.status in ('refunded','returned') then 0 else o.total end) as revenue
  from public.orders o
  where o.status not in ('cancelled','payment_pending','payment_failed')
    and o.archived_at is null
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

create or replace function public.analytics_top_products(
  p_days integer default 30,
  p_limit integer default 10
) returns table (
  product_id uuid,
  units bigint,
  revenue numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (item ->> 'id')::uuid as product_id,
    sum((item ->> 'qty')::int)::bigint as units,
    sum((item ->> 'qty')::int * (item ->> 'price')::numeric)::numeric as revenue
  from public.v_orders_revenue o
  cross join lateral jsonb_array_elements(
    (select items from public.orders where id = o.id)
  ) as item
  where o.created_at >= now() - (p_days || ' days')::interval
    and (item ->> 'id') is not null
    -- Only orders that actually earned revenue rank products: the view keeps
    -- refunded/returned rows as placed orders with revenue zeroed, and this
    -- function used to re-derive their item revenue at full price.
    and o.revenue > 0
  group by 1
  order by revenue desc, units desc
  limit p_limit;
$$;
