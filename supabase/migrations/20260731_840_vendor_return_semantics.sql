-- Migration 840 — the vendor orphan guard learns return semantics.
--
-- The Vendors page probe flagged EVERY vendor order lacking a payout row,
-- including refused/returned parcels from self-stocked vendors
-- (settlement_direction = 'vendor_collects', e.g. Nazirs Group). For those,
-- the missing payout is the CORRECT end state: the vendor shipped their own
-- goods, the customer refused, the parcel went back to the vendor's shelf —
-- no cash and no goods ever touched the store, so nobody owes anybody.
-- Following the banner's advice ("Recalculate from vendor rate") would have
-- fabricated a payout for a sale that never happened.
--
-- The guard now skips:
--   • archived orders (out of every operational surface by definition),
--   • cancelled orders (never fulfilled — nothing owed in either direction),
--   • returned/refunded orders of vendor_collects vendors (see above).
-- It still flags returned/refunded orders of we_collect vendors: there the
-- store bought the goods and shipped them itself, so the payable to the
-- vendor stands even though the parcel came back (the goods are back in the
-- store's stock, holding their value — handled app-side by zeroing the
-- unearned margin and restocking, not by dropping the debt).

create or replace function public.vendor_orders_missing_settlement()
returns table (order_id uuid, order_number text)
language sql
stable
security definer
set search_path = public
as $$
  select o.id as order_id, o.order_number
  from orders o
  join vendors v on v.id = o.vendor_id
  where o.archived_at is null
    and o.status <> 'cancelled'
    and not (o.status in ('returned', 'refunded') and v.settlement_direction = 'vendor_collects')
    and not exists (
      select 1 from vendor_settlements s
      where s.order_id = o.id and s.vendor_id = o.vendor_id
    )
  order by o.created_at desc
  limit 50;
$$;

revoke execute on function public.vendor_orders_missing_settlement() from public;
revoke execute on function public.vendor_orders_missing_settlement() from anon, authenticated;
