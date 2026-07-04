-- Migration 400 — analytics_top_products ranks by revenue, not units.
--
-- The Analytics → Sales "Top products" card sat directly under an insight
-- callout naming the store's biggest earner, yet ranked by units sold with no
-- secondary sort, so that earner appeared 7th and tied rows landed in
-- arbitrary order. Rank by revenue (units as the tiebreak) so the card agrees
-- with the callout above it and ties are deterministic. Signature unchanged.

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
  group by 1
  order by revenue desc, units desc
  limit p_limit;
$$;
-- create or replace preserves existing privileges (service_role-only per
-- migrations 130/131), so no grant/revoke needed here.
