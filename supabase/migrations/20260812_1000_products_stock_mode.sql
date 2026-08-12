-- Migration 1000 — say out loud who holds the stock.
--
-- `track_inventory` is one boolean carrying two different meanings: "we don't
-- count this" and "somebody else counts this". The 12 Aug inventory audit
-- showed how far apart those are — every product with a vendor was hidden from
-- the Inventory screen, while every product ON the screen had no vendor at all,
-- and 464 products sat in an unlabelled middle with neither.
--
--   own       Yellow Pink physically holds it. Counted, and checkout enforces it.
--   external  A vendor / dropshipper / consignor holds it. Their count, not
--             ours; never enforced, never an inventory asset on our books.
--   untracked We sell it and deliberately do not count it. No vendor behind it.
--
-- track_inventory stays, derived, because 33 files read it and place_order
-- gates on it. The trigger below keeps the two in lockstep so nothing has to
-- change at once.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_mode text NOT NULL DEFAULT 'own';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_mode_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_stock_mode_check
      CHECK (stock_mode IN ('own', 'external', 'untracked'));
  END IF;
END $$;

COMMENT ON COLUMN public.products.stock_mode IS
  'own = we hold and count it (checkout enforces stock); external = a vendor holds it (never enforced, zero inventory asset); untracked = we sell it and deliberately do not count it. track_inventory is derived from this by products_sync_stock_mode.';

-- ── Backfill ───────────────────────────────────────────────────────────────
-- Order matters: the seed-clearance rule is the most specific and must win.
-- The 87 products whose fictional 2026-05-19 stock seed was cleared are
-- external by an explicit owner decision ("all these fictional 50s should have
-- been managed externally"), not merely uncounted — several have no vendor row
-- yet, so the vendor_id rule below would have mislabelled them 'untracked'.
UPDATE public.products SET stock_mode = 'untracked'
 WHERE NOT COALESCE(track_inventory, true);

UPDATE public.products SET stock_mode = 'own'
 WHERE COALESCE(track_inventory, true);

UPDATE public.products SET stock_mode = 'external'
 WHERE vendor_id IS NOT NULL;

UPDATE public.products SET stock_mode = 'external'
 WHERE id IN (
   SELECT DISTINCT product_id FROM public.inventory_ledger
   WHERE note LIKE 'Cleared 2026-05-19 import seed%'
 );

-- ── Keep the boolean and the enum honest ───────────────────────────────────
-- Bidirectional on purpose. Until ProductForm, the CSV importer and the
-- validators all speak stock_mode, three code paths still write
-- track_inventory directly; a one-way trigger would let the two drift apart
-- silently, which is exactly the class of bug this column exists to end.
--
-- The reverse direction is lossy (false maps to both 'external' and
-- 'untracked'), so unticking the box on a product that was already external
-- keeps it external rather than demoting it to untracked.
CREATE OR REPLACE FUNCTION public.sync_stock_mode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- An insert that names stock_mode wins; otherwise derive from the boolean.
    IF NEW.stock_mode IS DISTINCT FROM 'own' THEN
      NEW.track_inventory := (NEW.stock_mode = 'own');
    ELSE
      NEW.stock_mode := CASE WHEN COALESCE(NEW.track_inventory, true)
                             THEN 'own' ELSE 'untracked' END;
      NEW.track_inventory := (NEW.stock_mode = 'own');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.stock_mode IS DISTINCT FROM OLD.stock_mode THEN
    NEW.track_inventory := (NEW.stock_mode = 'own');
  ELSIF NEW.track_inventory IS DISTINCT FROM OLD.track_inventory THEN
    NEW.stock_mode := CASE
      WHEN NEW.track_inventory            THEN 'own'
      WHEN OLD.stock_mode = 'external'    THEN 'external'
      ELSE 'untracked'
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS products_sync_stock_mode ON public.products;
CREATE TRIGGER products_sync_stock_mode
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.sync_stock_mode();

CREATE INDEX IF NOT EXISTS products_stock_mode_idx
  ON public.products (stock_mode) WHERE status = 'published';
