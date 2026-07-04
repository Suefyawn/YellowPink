-- Migration 420 — one customer identity across the Customers list & order detail.
--
-- The order-detail page counts a buyer's lifetime orders by user_id OR email OR
-- phone, but the Customers list keyed registered accounts by user_id ONLY
-- (get_customer_order_stats) and excluded registered-email guests from the
-- guest list without folding them back — so a registered user's guest-checkout
-- orders (user_id null, same email/phone) were counted on NEITHER surface, and
-- the same person could show a different order count on each page.
--
-- Both RPCs now use the SAME identity rule as order detail: an order belongs to
-- a registered account when it shares that account's user_id, email, or
-- (digits-only) phone. Each order is attributed to at most ONE account
-- (priority user_id > email > phone) so shared contact details can't
-- double-count it. Guests are only the orders that match no account at all.
-- Canonical revenue basis throughout (cancelled/unpaid excluded, refunds → 0),
-- matching migration 380 and v_orders_revenue. Signatures unchanged.

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
  -- Attribute each qualifying order to a single account (best match wins).
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
    order by o.id,
      case
        when o.user_id = a.id then 1
        when a.email is not null and lower(o.email) = a.email then 2
        else 3
      end
  )
  select
    acct_id                                                              as user_id,
    count(*)::bigint                                                     as order_count,
    coalesce(sum(case when status = 'refunded' then 0 else total end), 0) as total_spent,
    max(created_at)                                                      as last_order_at
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
      -- Exclude orders that belong to a registered account by EMAIL or PHONE
      -- (previously only email) so those fold into the account's row instead of
      -- showing as a separate guest.
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
    coalesce(sum(case when status = 'refunded' then 0 else total end), 0) as total_spent,
    max(created_at)                                              as last_order_at,
    min(created_at)                                              as first_order_at
  from guest_orders
  group by gkey;
$$;

revoke all on function public.get_guest_customers() from public, anon, authenticated;
grant execute on function public.get_guest_customers() to service_role;
