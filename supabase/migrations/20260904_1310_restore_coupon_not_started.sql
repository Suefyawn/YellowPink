-- Migration 1060 added the coupon start-date gate to place_order by patching
-- the live function body in place. Migration 1240 (free shipping after
-- discount) then re-created place_order from the repo's full text, which
-- never carried that patch — so the gate silently disappeared, in production
-- and in the from-scratch chain alike. Symptom: the place_order forgery
-- matrix fails on "scheduled coupon not yet started: order was accepted";
-- a shopper who knows a scheduled code can redeem it at checkout early
-- (lookup_coupon hides it from the storefront, place_order does not refuse it).
--
-- Re-apply the 1060 patch, idempotently, so it survives the chain in any
-- order. Any future full re-creation of place_order must carry this block.
DO $mig$
DECLARE
  def text;
  before text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO def
    FROM pg_proc WHERE proname = 'place_order' AND pronamespace = 'public'::regnamespace;

  IF position('coupon_not_started' IN def) > 0 THEN
    RAISE NOTICE 'place_order already carries the coupon_not_started gate; nothing to do';
    RETURN;
  END IF;

  before := def;
  def := replace(def,
    'if v_cp.expires_at is not null and v_cp.expires_at < now() then
      raise exception ''coupon_expired'';
    end if;',
    'if v_cp.expires_at is not null and v_cp.expires_at < now() then
      raise exception ''coupon_expired'';
    end if;
    if v_cp.starts_at is not null and v_cp.starts_at > now() then
      raise exception ''coupon_not_started'';
    end if;');
  IF def = before THEN RAISE EXCEPTION 'place_order patch failed: coupon_expired gate not found'; END IF;

  EXECUTE def;
END $mig$;
