-- Migration 1010 — give reorder points a working default.
--
-- reorder_point was 0 on all 582 rows, and the Inventory screen's "Reorder
-- needed" panel filters on `reorder_point > 0`, so the panel and its WhatsApp
-- purchase-order flow had never rendered once since they were built. The
-- column's own comment offered "0 = use the global low-stock alert", but no
-- global fallback was ever wired up, so 0 just meant off.
--
-- Owner's call: a global default of 5. Applied to every product, not only the
-- 18 currently marked 'own' — the panel already ignores anything we do not
-- hold, and seeding the column everywhere means a product flipped to 'own'
-- after its physical count arrives with a working reorder level instead of a
-- silent 0.

ALTER TABLE public.products ALTER COLUMN reorder_point SET DEFAULT 5;

UPDATE public.products SET reorder_point = 5 WHERE COALESCE(reorder_point, 0) = 0;

COMMENT ON COLUMN public.products.reorder_point IS
  'Flag this product for reorder when its counted stock falls to this level. Default 5. Only consulted for stock_mode = ''own'' — the Inventory screen never reorders stock somebody else holds.';
