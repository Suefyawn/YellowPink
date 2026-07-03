-- Integrity probe for the Vendors page: orders that are assigned to a vendor
-- but have no corresponding payout row. In a healthy system this is always
-- empty — a non-empty result means the settlement writer failed (it failed
-- silently for a day when migration 304 was missing from production) and the
-- outstanding totals are understating reality.
create or replace function public.vendor_orders_missing_settlement()
returns table (order_id uuid, order_number text)
language sql
stable
security definer
set search_path = public
as $$
  select o.id as order_id, o.order_number
  from orders o
  where o.vendor_id is not null
    and not exists (
      select 1 from vendor_settlements s
      where s.order_id = o.id and s.vendor_id = o.vendor_id
    )
  order by o.created_at desc
  limit 50;
$$;

revoke execute on function public.vendor_orders_missing_settlement() from public;
revoke execute on function public.vendor_orders_missing_settlement() from anon, authenticated;
