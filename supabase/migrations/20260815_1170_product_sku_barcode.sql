-- Migration 1170 — SKU and barcode on products (Shopify's Inventory card
-- vocabulary: "SKU (Stock Keeping Unit)" and "Barcode (ISBN, UPC, GTIN,
-- etc.)"). Simple (no-variant) products get both fields on the product form;
-- product_variants already carries sku (migration 010) and gains barcode for
-- parity. Nullable text, no backfill: blank means "not assigned yet".

alter table public.products add column if not exists sku text;
alter table public.products add column if not exists barcode text;
alter table public.product_variants add column if not exists barcode text;

comment on column public.products.sku is
  'SKU (Stock Keeping Unit) for simple products; variable products keep per-variant SKUs on product_variants.';
comment on column public.products.barcode is
  'Barcode (ISBN, UPC, GTIN, etc.) for simple products.';
comment on column public.product_variants.barcode is
  'Barcode (ISBN, UPC, GTIN, etc.) for this variant.';
