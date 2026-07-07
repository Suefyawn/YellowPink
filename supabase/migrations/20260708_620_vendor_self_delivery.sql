-- Migration 620 — vendor-level delivery model.
--
-- Some vendors deliver to the customer themselves instead of dropping stock to
-- us to ship via TCS. NB Sons is the first: they fulfil AND deliver their own
-- orders (for now at no extra charge, but they may start billing us for it).
-- For every other vendor the flow is unchanged: they bring the product to us
-- and we book the courier.
--
--   self_delivers  — true = the vendor ships to the customer directly; the admin
--                    should NOT book TCS for that order, and its delivery cost is
--                    whatever the vendor bills us (delivery_fee), not a courier
--                    charge.
--   delivery_fee   — PKR the vendor charges us per self-delivered order. Default
--                    0 ("no extra charge for now"); raise it when they start
--                    billing and it flows into the order's delivery_cost + the
--                    Finance shipping-margin figures.

alter table public.vendors
  add column if not exists self_delivers boolean not null default false,
  add column if not exists delivery_fee numeric not null default 0;

comment on column public.vendors.self_delivers is
  'Vendor ships to the customer directly (no TCS booking); its delivery cost is delivery_fee, not a courier charge.';
comment on column public.vendors.delivery_fee is
  'PKR the vendor bills us per self-delivered order (0 = no charge). Feeds orders.delivery_cost when the vendor self-delivers.';
