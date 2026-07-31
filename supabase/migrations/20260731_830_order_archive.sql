-- ============================================================================
-- Order archiving. 2026-07-31.
--
-- Some orders are history, not operations: the 12 WordPress-era imports were
-- fulfilled long before this system existed, yet they sat in every list and
-- inflated every money metric. Deleting them would erase real history and
-- forcing them through the status machine misrepresents them as normal
-- orders. Archiving is the honest middle: `archived_at` is orthogonal to
-- status (the status keeps saying what physically happened), and an archived
-- order disappears from operational lists, dashboards, finance, analytics
-- and the daily nudge sweep while staying queryable forever. Reversible via
-- unarchive; both directions are audit-logged app-side.
--
-- Metric surfaces updated here (SQL) — app queries updated in the same PR:
--   • v_orders_revenue view (feeds analytics_daily, analytics_kpis, customer
--     stats, top-products-by-revenue) — archived orders excluded at the source.
--   • dashboard_kpis() RPC (dashboard revenue/order-count/status-histogram/
--     top-products).
-- ============================================================================

alter table public.orders
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by text;
comment on column public.orders.archived_at is
  'Archived orders are history, not operations: hidden from lists, dashboards, finance and nudges; status still records what physically happened. NULL = live.';

-- The exclusion at the reporting source. Definition = migration 350's view
-- plus the archived filter; security_invoker re-asserted (migration 430).
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
where o.status not in ('cancelled','payment_pending','payment_failed')
  and o.archived_at is null;
alter view public.v_orders_revenue set (security_invoker = true);

-- dashboard_kpis (migration 068) with archived orders excluded everywhere.
create or replace function public.dashboard_kpis()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with revenue as (
    select coalesce(sum(total), 0) as v, count(*) as n
      from public.orders
      where status <> 'cancelled' and archived_at is null
  ),
  counts as (
    select status, count(*) as n
      from public.orders
      where archived_at is null
      group by status
  ),
  status_obj as (
    select jsonb_object_agg(status, n) as obj from counts
  ),
  items_flat as (
    select (item->>'id')         as id,
           (item->>'name')       as name,
           (item->>'brand')      as brand,
           coalesce((item->>'qty')::int, 0) as qty
      from public.orders o, jsonb_array_elements(o.items) item
      where status <> 'cancelled' and archived_at is null
  ),
  top as (
    select id, name, brand, sum(qty) as qty
      from items_flat
      group by id, name, brand
      order by sum(qty) desc
      limit 5
  ),
  top_arr as (
    select coalesce(
      jsonb_agg(jsonb_build_object('id', id, 'name', name, 'brand', brand, 'qty', qty)),
      '[]'::jsonb
    ) as arr
    from top
  ),
  total_orders as (
    select count(*) as n from public.orders where archived_at is null
  )
  select jsonb_build_object(
    'total_revenue', (select v from revenue),
    'order_count',   (select n from total_orders),
    'status_counts', coalesce((select obj from status_obj), '{}'::jsonb),
    'top_products',  (select arr from top_arr)
  );
$$;

revoke execute on function public.dashboard_kpis() from anon, authenticated;
grant execute on function public.dashboard_kpis() to service_role;
