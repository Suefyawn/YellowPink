-- Migration 133 — get_guest_customers: surface guest buyers in the admin
-- Customers list.
--
-- Guest checkout writes orders with user_id = null and captures the buyer's
-- contact details (email / name / phone) inline on the order. The Customers
-- list was built only on auth.users (get_admin_users) joined to per-account
-- order stats (get_customer_order_stats, which filters user_id IS NOT NULL),
-- so guests — the majority of buyers — never appeared at all.
--
-- This RPC aggregates the unclaimed (user_id IS NULL) orders into one row per
-- guest, keyed by email (falling back to phone when an order has no email).
-- It deliberately EXCLUDES any guest whose email matches a registered account:
-- those orders belong to a real account holder who simply checked out without
-- logging in, and claim_guest_orders() will fold them back under that account.
-- Listing them again as a separate "guest" would double-show the same person.
--
-- SECURITY DEFINER so the admin page can read order totals (and probe
-- auth.users for the registered-email exclusion) without a broad grant on the
-- RLS-locked orders table; granted to service_role only — it exposes revenue
-- data and must never reach anon.

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
      -- Identity key: email when present, else phone. Emailless guests are
      -- effectively only the QA test order, but keying on phone keeps any
      -- genuine phone-only buyer visible rather than silently dropped.
      coalesce(nullif(lower(o.email), ''), 'phone:' || o.phone) as gkey
    from public.orders o
    where o.user_id is null
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
    coalesce(sum(total) filter (where status <> 'cancelled'), 0) as total_spent,
    max(created_at)                                              as last_order_at,
    min(created_at)                                              as first_order_at
  from guest_orders
  group by gkey;
$$;

revoke all on function public.get_guest_customers() from public, anon, authenticated;
grant execute on function public.get_guest_customers() to service_role;
