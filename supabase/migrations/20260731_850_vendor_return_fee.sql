-- Migration 850 — per-vendor return-shipping fee.
--
-- Self-delivering vendors (Nazirs Group model: their stock, their rider,
-- they collect the COD) eat the parcel when a customer refuses — but some
-- bill the store for the failed round trip. That charge is a real loss the
-- store owes the vendor, distinct from the voided sale.
--
-- vendors.return_fee: PKR the vendor charges per refused/returned parcel.
-- NULL or 0 = they don't charge. Applied by the app when an order moves to
-- 'returned' (see applyReturnFinancials): recorded as the order's
-- delivery_cost (Finance's sunk return-cost line reads it) and as a pending
-- payable to the vendor on the Vendors page.

alter table public.vendors
  add column if not exists return_fee numeric(12,2);

comment on column public.vendors.return_fee is
  'PKR this vendor charges the store per refused/returned self-delivered parcel (failed round trip). NULL/0 = no charge. Applied on order return.';
