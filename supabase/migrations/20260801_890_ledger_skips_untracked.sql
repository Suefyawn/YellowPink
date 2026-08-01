-- Migration 890 — order-driven restocks skip untracked products.
--
-- place_order only decrements stock for products with track_inventory =
-- true, but the cancellation/return restock path credited EVERY line item,
-- so an untracked (vendor-managed) product's stock counter drifted upward
-- with each bounced order (2026-08-01 audit, long tail). Fixed at the RPC
-- layer so every caller (manual cancel, courier return, RMA receipt,
-- return-financials lib, failed-payment restock) inherits it.
--
-- Scope: only the order-reversal reasons ('cancellation', 'return') skip
-- untracked products. Manual/adjustment/import reasons still apply — an
-- admin explicitly editing a number should win, tracked or not. Variant
-- rows are untouched (variants always track).
--
-- Body is migration 300's (applied-delta clamp accounting) plus the
-- untracked guard; same signature and return row, so CREATE OR REPLACE.

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
    -- Order-reversal restocks mirror place_order: untracked products were
    -- never decremented, so they must not be credited either.
    IF p_reason IN ('cancellation', 'return') THEN
      SELECT COALESCE(track_inventory, true) INTO v_tracked
        FROM public.products WHERE id = p_product_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'record_stock_change: product % not found', p_product_id;
      END IF;
      IF NOT v_tracked THEN
        RETURN; -- no stock change, no ledger row — nothing was ever debited
      END IF;
    END IF;
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

  -- The delta the stock scalar actually moved by. Differs from p_qty_delta
  -- only when the removal was clamped at zero.
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

REVOKE ALL ON FUNCTION public.record_stock_change(uuid,uuid,integer,inventory_reason,uuid,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_stock_change(uuid,uuid,integer,inventory_reason,uuid,uuid,text,text,text) TO service_role;
