-- Migration 610 — cascade a `returned` shipment status onto the order.
--
-- The shipment→order sync trigger (migration 20260521_040_shipments.sql) only
-- advanced the order for delivered / picked_up / in_transit / out_for_delivery;
-- every other shipment status fell through the `else` and left the order status
-- unchanged. So when a COD parcel was refused and returned to origin
-- ("Recipient Refused To Accept" → "Shipment Returned To Origin"), the order
-- kept showing as `shipped` no matter how many times tracking was synced.
--
-- Fix: map a `returned` shipment to order status `returned`. This is for
-- reporting/revenue only — it deliberately does NOT restock (goods are still in
-- transit back to us; physical restock happens through the returns flow on
-- receipt, and cancellation restock stays the cancel-only path). `failed` (a
-- single unsuccessful attempt that may be re-attempted), `created` and
-- `cancelled` still leave the order status alone here.

create or replace function public.sync_order_tracking_from_shipment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
    set tracking_number = coalesce(new.tracking_number, tracking_number),
        courier         = coalesce(new.courier, courier),
        status          = case
                            when new.status = 'delivered' then 'delivered'
                            when new.status = 'returned' then 'returned'
                            when new.status in ('picked_up','in_transit','out_for_delivery') then 'shipped'
                            else status
                          end
    where id = new.order_id;
  return new;
end $$;

-- Trigger definition itself is unchanged (already fires on insert/update); only
-- the function body above is replaced.
