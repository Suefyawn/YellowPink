-- Per-product reorder point. Inventory previously flagged "low stock" with a
-- single global threshold (≤5) for every SKU — but a fast-moving bestseller
-- needs reordering far earlier than a slow one. This per-product threshold
-- drives a "reorder needed" list (grouped by vendor, with a WhatsApp PO link)
-- on the inventory page. 0 = use the global low-stock threshold / off.
alter table public.products
  add column if not exists reorder_point integer not null default 0
    check (reorder_point >= 0);

comment on column public.products.reorder_point is
  'Stock level at or below which this product should be reordered. Drives the '
  'inventory "reorder needed" list. 0 = no per-product point (falls back to the '
  'global low-stock threshold).';
