-- Measuring the cash-on-delivery confirmation link
-- ================================================
--
-- The one-click confirm link (/order/confirm) shipped on 14 Sep 2026 against a
-- 31% COD cancellation rate. The owner asked the obvious question — "watch what
-- on it?" — and the honest answer was that nothing could be watched, because
-- the two ways an order gets confirmed were recorded in two different places:
--
--   * a CUSTOMER pressing the link sets orders.confirmed_at and writes an
--     order_events row with actor_id = 'customer-link';
--   * a STAFF member recording a WhatsApp "yes" sets the same confirmed_at
--     column and wrote only an audit_log row.
--
-- So confirmed_at alone cannot tell the two apart, and the whole point of the
-- link is that it confirms orders WITHOUT staff having to reach the customer.
-- setOrderConfirmed now writes an order_events row too (actor_kind 'staff'),
-- which also puts staff confirmations on the order timeline where they always
-- should have been.
--
-- This function reads both routes out of order_events and reports the split.
--
-- A caveat that belongs next to the numbers rather than buried: the gap
-- between "confirmed orders rarely cancel" and "unconfirmed orders usually do"
-- is PARTLY DEFINITIONAL. Staff cancel an order when they cannot reach the
-- customer, and an order they cannot reach is also an order nobody confirmed.
-- So the confirmed/unconfirmed cancellation split is not proof the link works.
-- The number that would be proof is confirmed_by_link rising while the overall
-- cancellation rate falls, which needs orders placed after 14 Sep to exist.

create or replace function public.analytics_cod_confirmation(
  p_days integer default 120,
  -- The day the confirm link went into the order email. Orders before it
  -- could never have been confirmed this way, so they are counted separately;
  -- mixing them in would permanently dilute the link's rate.
  p_link_live date default date '2026-09-14'
)
returns table (
  cod_orders bigint,
  confirmed bigint,
  confirmed_by_link bigint,
  confirmed_by_staff bigint,
  cancelled bigint,
  cancelled_confirmed bigint,
  cancelled_unconfirmed bigint,
  link_era_orders bigint,
  link_era_confirmed bigint,
  link_era_confirmed_by_link bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with cod as (
    select
      o.id,
      o.status,
      o.confirmed_at,
      (o.created_at at time zone 'Asia/Karachi')::date >= p_link_live as link_era
    from public.orders o
    where o.pay_method = 'cod'
      and o.created_at >= now() - (p_days || ' days')::interval
  ),
  routed as (
    select
      c.*,
      exists (
        select 1 from public.order_events e
        where e.order_id = c.id and e.actor_id = 'customer-link'
      ) as via_link
    from cod c
  )
  select
    count(*)                                                              as cod_orders,
    count(*) filter (where confirmed_at is not null)                      as confirmed,
    count(*) filter (where confirmed_at is not null and via_link)         as confirmed_by_link,
    count(*) filter (where confirmed_at is not null and not via_link)     as confirmed_by_staff,
    count(*) filter (where status = 'cancelled')                          as cancelled,
    count(*) filter (where status = 'cancelled' and confirmed_at is not null)     as cancelled_confirmed,
    count(*) filter (where status = 'cancelled' and confirmed_at is null)         as cancelled_unconfirmed,
    count(*) filter (where link_era)                                      as link_era_orders,
    count(*) filter (where link_era and confirmed_at is not null)         as link_era_confirmed,
    count(*) filter (where link_era and confirmed_at is not null and via_link) as link_era_confirmed_by_link
  from routed
$$;

revoke all on function public.analytics_cod_confirmation(integer, date) from public, anon, authenticated;
grant execute on function public.analytics_cod_confirmation(integer, date) to service_role;
