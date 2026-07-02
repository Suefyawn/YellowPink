-- Migration 300 — record_stock_change: ledger must record the APPLIED delta.
--
-- Audit 2026-07-02. The stock update clamps at zero
-- (`GREATEST(0, stock + p_qty_delta)`), but the ledger row logged the full
-- requested `p_qty_delta`. A manual removal larger than on-hand stock (e.g.
-- -10 against 4 units) wrote qty_delta = -10 with balance_after = 0, so the
-- running balance no longer equalled the sum of deltas — the exact invariant
-- the ledger exists to keep — and the admin UI reported plain success.
--
-- Fix: read the pre-update stock (FOR UPDATE, same lock the UPDATE takes),
-- log the difference actually applied, and note the clamp on the ledger row.
-- The function now also returns `applied_delta` so callers (the admin
-- adjustment action) can warn the operator when a clamp happened.
--
-- DROP + CREATE (not CREATE OR REPLACE) because the OUT row type changes;
-- the REVOKE/GRANT lockdown from migration 078 is re-applied below. Existing
-- SQL callers (place_order in 079/108/301) use PERFORM and are unaffected.

DROP FUNCTION IF EXISTS public.record_stock_change(uuid,uuid,integer,inventory_reason,uuid,uuid,text,text,text);

CREATE FUNCTION public.record_stock_change(
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

-- Re-apply the migration-078 lockdown (DROP discards grants): storefront
-- stock changes flow through place_order (SECURITY DEFINER); admin changes
-- flow through the service role.
REVOKE ALL ON FUNCTION public.record_stock_change(uuid,uuid,integer,inventory_reason,uuid,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_stock_change(uuid,uuid,integer,inventory_reason,uuid,uuid,text,text,text) TO service_role;
