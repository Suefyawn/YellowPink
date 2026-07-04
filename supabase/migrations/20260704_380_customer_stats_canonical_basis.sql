-- Migration 380 — Customers-list money on the canonical revenue basis.
--
-- get_customer_order_stats (126) and get_guest_customers (133) excluded only
-- status='cancelled' from total_spent and counted EVERY order in order_count,
-- while the store's canonical basis (v_orders_revenue, migration 350 — used by
-- Segments, Analytics and the KPIs) excludes cancelled/payment_pending/
-- payment_failed and zeroes refunded orders. The Customers page therefore
-- overstated spend (~31% on live data) and disagreed with Segments for the
-- same person: a refunded-only customer showed "Spent PKR 4,240" here and
-- PKR 0 on Segments; unpaid gateway orders inflated both count and spend; the
-- filtered CSV export inherited the same numbers.
--
-- Both RPCs now use the same status filter + refunded-to-zero rule as
-- v_orders_revenue (kept inline: the view has no user_id-less contact fields
-- needed here, and both functions are SECURITY DEFINER single-statement SQL).
-- Guests or accounts whose every order is cancelled/unpaid no longer carry
-- fake "1 order" rows. Signatures are unchanged, no app-code change needed.

create or replace function public.get_customer_order_stats()
returns table (
  user_id       uuid,
  order_count   bigint,
  total_spent   numeric,
  last_order_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    o.user_id,
    count(*)                                                             as order_count,
    coalesce(sum(case when o.status = 'refunded' then 0 else o.total end), 0) as total_spent,
    max(o.created_at)                                                    as last_order_at
  from public.orders o
  where o.user_id is not null
    and o.status not in ('cancelled','payment_pending','payment_failed')
  group by o.user_id;
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
set search_path = public
as $$
  with guest_orders as (
    select
      o.*,
      coalesce(nullif(lower(o.email), ''), 'phone:' || o.phone) as gkey
    from public.orders o
    where o.user_id is null
      -- Canonical revenue basis (matches v_orders_revenue): unpaid gateway
      -- attempts and cancellations are not orders; refunds are orders with
      -- zero revenue (handled in total_spent below).
      and o.status not in ('cancelled','payment_pending','payment_failed')
      and not exists (
        select 1
        from auth.users u
        where u.email is not null
          and o.email is not null
          and lower(u.email) = lower(o.email)
      )
  )
  select
    gkey                                                          as guest_key,
    (array_agg(email      order by created_at desc))[1]          as email,
    (array_agg(first_name order by created_at desc))[1]          as first_name,
    (array_agg(last_name  order by created_at desc))[1]          as last_name,
    (array_agg(phone      order by created_at desc))[1]          as phone,
    count(*)                                                      as order_count,
    coalesce(sum(case when status = 'refunded' then 0 else total end), 0) as total_spent,
    max(created_at)                                              as last_order_at,
    min(created_at)                                              as first_order_at
  from guest_orders
  group by gkey;
$$;

revoke all on function public.get_guest_customers() from public, anon, authenticated;
grant execute on function public.get_guest_customers() to service_role;
