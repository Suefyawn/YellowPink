-- Per-order actual goods cost. We drop-ship, so the price paid to the supplier
-- for the same product varies order to order — a single products.cost_price
-- (migration 141) can't capture that. This column lets staff record the real
-- acquisition cost for THIS order on the order page; when set it overrides the
-- computed COGS (vendor settlement + product cost_price) in Finance.
-- Nullable, additive; falls back to the computed estimate when left blank.
alter table public.orders
  add column if not exists acquisition_cost numeric(12,2)
    check (acquisition_cost is null or acquisition_cost >= 0);

comment on column public.orders.acquisition_cost is
  'Actual goods cost paid for this order (drop-ship price varies per order). '
  'Overrides the computed COGS in Finance when set; blank falls back to '
  'vendor settlement + products.cost_price.';
