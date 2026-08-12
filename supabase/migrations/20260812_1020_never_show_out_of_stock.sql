-- Migration 1020 — a live product does not go out of stock unless we say so.
--
-- Owner's rule: "if we don't have it on us, we will get it somehow", so a
-- shopper should never be shown a dead listing. The obvious implementation was
-- to auto-flip a product to stock_mode='external' the moment its count hit
-- zero, but that throws away the very fact we just spent the day establishing:
-- an item would drop OUT of "Reorder needed" at the exact moment it needed
-- reordering, and we would lose the record that we normally hold it.
--
-- So the count stays honest and the SELLING rule moves instead. A product is
-- blocked at checkout only when we hold it AND someone has deliberately said
-- this one may not oversell. Default is to keep selling, matching the owner's
-- stance; staff untick it per product for genuinely unrepeatable stock.
--
-- The stock DEBIT is untouched: an own-stock sale still counts down, and
-- record_stock_change clamps at zero and notes the clamp in the ledger, so an
-- oversell is visible in Movement history rather than silent.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS continue_selling_when_out boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.products.continue_selling_when_out IS
  'true (default) = keep selling after the count reaches zero; the storefront never shows it out of stock. false = a genuine sell-out, checkout refuses it. Only consulted for stock_mode = ''own'' — external/untracked products are always sellable regardless.';

-- Patch place_order in place rather than restating a 16 KB body that five
-- later migrations have already amended. Each edit asserts it matched, so a
-- future change to the function makes this migration fail loudly instead of
-- silently leaving the gate as it was.
DO $mig$
DECLARE
  def text;
  before text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO def
    FROM pg_proc WHERE proname = 'place_order' AND pronamespace = 'public'::regnamespace;

  -- 1. declare the flag
  before := def;
  def := replace(def,
    '  v_track              boolean;',
    '  v_track              boolean;' || chr(10) || '  v_continue           boolean;');
  IF def = before THEN RAISE EXCEPTION 'place_order patch 1/4 failed: v_track declaration not found'; END IF;

  -- 2. load it alongside track_inventory
  before := def;
  def := replace(def,
    'select stock, price, coalesce(track_inventory, true), status, vendor_id
      into v_stock, v_unit_price, v_track, v_status, v_vendor_id',
    'select stock, price, coalesce(track_inventory, true), status, vendor_id, coalesce(continue_selling_when_out, true)
      into v_stock, v_unit_price, v_track, v_status, v_vendor_id, v_continue');
  IF def = before THEN RAISE EXCEPTION 'place_order patch 2/4 failed: product select not found'; END IF;

  -- 3. the shade gate
  before := def;
  def := replace(def,
    'if v_track then
        if v_variant_stock is null or v_variant_stock < v_qty then',
    'if v_track and not v_continue then
        if v_variant_stock is null or v_variant_stock < v_qty then');
  IF def = before THEN RAISE EXCEPTION 'place_order patch 3/4 failed: variant gate not found'; END IF;

  -- 4. the simple-product gate. NOTE: the third `if v_track then` in this
  -- function guards the stock DEBIT and is deliberately left alone.
  before := def;
  def := replace(def,
    'if v_track then
        if v_stock is null or v_stock < v_qty then',
    'if v_track and not v_continue then
        if v_stock is null or v_stock < v_qty then');
  IF def = before THEN RAISE EXCEPTION 'place_order patch 4/4 failed: product gate not found'; END IF;

  EXECUTE def;
END $mig$;
