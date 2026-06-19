-- Per-unit acquisition cost for OWN-STOCK products, so Finance can compute the
-- real profit on a sale for items we buy and hold ourselves. Vendor-sourced
-- items already carry their cost via products.vendor_cost / vendor_settlements
-- (migration 109); this column is the equivalent for everything else, which
-- previously had no cost basis and therefore showed up as 100% margin.
--
-- Nullable, additive, and read only by the admin Finance calc — no storefront
-- effect. Entered on the product page (Vendor & sourcing section).
alter table public.products
  add column if not exists cost_price numeric(12,2)
    check (cost_price is null or cost_price >= 0);

comment on column public.products.cost_price is
  'What Yellow Pink paid per unit to acquire own-stock inventory. Used by the '
  'Finance COGS calc for non-vendor items; vendor items use vendor_cost instead.';
