-- Migration 990 — a cancellation must never invent stock, variants included.
--
-- Migration 890 stopped order reversals ('cancellation', 'return') from
-- crediting untracked products, but only on the product-level branch. Its
-- header states the reason the variant branch was left alone: "Variant rows
-- are untouched (variants always track)."
--
-- That assumption does not hold. place_order gates its debit on the PARENT
-- product's track_inventory for variant lines too:
--
--     select coalesce(track_inventory, true) into v_track
--       from public.products where id = v_product_id;
--     if v_track then
--       perform public.record_stock_change(v_product_id, v_variant_id, -qty, 'order', …);
--     end if;
--
-- So an untracked product sold as a shade is never debited at sale, while the
-- cancellation credits its variant unconditionally: stock created from
-- nothing, once per bounced order, exactly the drift 890 set out to kill.
-- At the time of writing 21 products with track_inventory = false carry 112
-- variant rows, 20 of those products published — a live hole, not a
-- theoretical one. It has not fired yet (0 such ledger rows), so there is no
-- historical data to repair; this closes it before it does.
--
-- The rule is now stated once and applies to both branches: an order-reversal
-- credit follows the same track_inventory gate that the original debit did.
-- Manual reasons (adjustment, import, restock, damage) still apply either way
-- — an admin editing a number explicitly should win, tracked or not.

CREATE OR REPLACE FUNCTION public.record_stock_change(
  p_product_id  uuid,
  p_variant_id  uuid,
  p_qty_delta   integer,
  p_reason      inventory_reason,
  p_order_id    uuid    DEFAULT NULL,
  p_return_id   uuid    DEFAULT NULL,
  p_actor_kind  text    DEFAULT 'system',
  p_actor_email text    DEFAULT NULL,
  p_note        text    DEFAULT NULL
)
RETURNS TABLE (ledger_id uuid, new_balance integer, applied_delta integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_balance integer;
  v_new_balance integer;
  v_applied     integer;
  v_note        text;
  v_ledger_id   uuid;
  v_tracked     boolean;
BEGIN
  IF p_product_id IS NULL AND p_variant_id IS NULL THEN
    RAISE EXCEPTION 'record_stock_change: both product_id and variant_id are NULL';
  END IF;

  -- The untracked guard, hoisted out of the product-only branch so a variant
  -- line obeys it too. Keyed on the PARENT product because that is the flag
  -- place_order consults when deciding whether to debit at all.
  IF p_reason IN ('cancellation', 'return') AND p_product_id IS NOT NULL THEN
    SELECT COALESCE(track_inventory, true) INTO v_tracked
      FROM public.products WHERE id = p_product_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'record_stock_change: product % not found', p_product_id;
    END IF;
    IF NOT v_tracked THEN
      RETURN;
    END IF;
  END IF;

  IF p_variant_id IS NOT NULL THEN
    SELECT stock INTO v_old_balance
      FROM public.product_variants WHERE id = p_variant_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'record_stock_change: variant % not found', p_variant_id;
    END IF;
    UPDATE public.product_variants
       SET stock = GREATEST(0, v_old_balance + p_qty_delta)
     WHERE id = p_variant_id
    RETURNING stock INTO v_new_balance;
  ELSE
    SELECT stock INTO v_old_balance
      FROM public.products WHERE id = p_product_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'record_stock_change: product % not found', p_product_id;
    END IF;
    UPDATE public.products
       SET stock = GREATEST(0, v_old_balance + p_qty_delta)
     WHERE id = p_product_id
    RETURNING stock INTO v_new_balance;
  END IF;

  v_applied := v_new_balance - COALESCE(v_old_balance, 0);
  v_note    := p_note;
  IF v_applied <> p_qty_delta THEN
    v_note := COALESCE(v_note || ' — ', '')
      || format('clamped at zero stock: requested %s, applied %s', p_qty_delta, v_applied);
  END IF;

  INSERT INTO public.inventory_ledger
    (product_id, variant_id, qty_delta, balance_after, reason,
     order_id, return_id, actor_kind, actor_email, note)
  VALUES
    (p_product_id, p_variant_id, v_applied, v_new_balance, p_reason,
     p_order_id, p_return_id, COALESCE(p_actor_kind, 'system'), p_actor_email, v_note)
  RETURNING id INTO v_ledger_id;

  RETURN QUERY SELECT v_ledger_id, v_new_balance, v_applied;
END $$;
