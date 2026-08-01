-- Migration 880 — two RPC stragglers from the 2026-08-01 audit's long tail.
--
-- • dashboard_kpis' top-products CTE filtered only `cancelled`, so units
--   from unpaid (payment_pending / payment_failed) and bounced
--   (refunded / returned) orders could rank the dashboard's Top Products.
--   Now the same no-revenue set as the revenue CTE above it.
-- • analytics_orders_by_status counted archived orders, so the Analytics
--   status histogram disagreed with the dashboard's (which excludes them).

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
      where status not in ('cancelled', 'payment_pending', 'payment_failed', 'refunded', 'returned')
        and archived_at is null
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
      where status not in ('cancelled', 'payment_pending', 'payment_failed', 'refunded', 'returned')
        and archived_at is null
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

create or replace function public.analytics_orders_by_status()
returns table (status text, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select status, count(*)::bigint
  from public.orders
  where archived_at is null
  group by status
  order by count(*) desc;
$$;
