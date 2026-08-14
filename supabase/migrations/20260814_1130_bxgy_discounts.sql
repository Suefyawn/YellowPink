-- Migration 1130 — Buy X Get Y discounts (Shopify's fourth discount method).
--
-- Config lives in coupons.bxgy (jsonb):
--   { "buy_product_ids": [uuid…], "buy_qty": 2,
--     "get_product_ids": [uuid…], "get_qty": 1,
--     "pct_off": 100, "max_per_order": 1 }
-- Works on both trigger kinds (a code the shopper types, or an automatic that
-- applies itself). The discount stays an order-level amount, computed over
-- the CHEAPEST qualifying "get" units — the maths every store uses so "buy 2
-- get 1 free" can't be gamed into discounting the priciest unit.
--
-- Overlap rule: when the buy and get pools share products (the classic
-- "buy 2 get 1 free" on the same product), one unit can't count as both, so
-- applications = floor(buyUnits / (buy_qty + get_qty)) — every 3rd unit free.
-- Disjoint pools use floor(buyUnits / buy_qty).
--
-- Mirrored EXACTLY by computeCouponDiscount in src/lib/coupon-validation.ts;
-- keep the two in lock-step or the drift check rejects honest orders.
-- place_order is patched in place (migration-1020 technique).

alter table public.coupons
  add column if not exists bxgy jsonb;

comment on column public.coupons.bxgy is
  'Buy X Get Y config: {buy_product_ids, buy_qty, get_product_ids, get_qty, pct_off (1-100), max_per_order}. When set it overrides the value/type maths.';

-- A BXGY coupon's discount comes from its config, not `value` — allow 0 there
-- (the same carve-out free-shipping coupons already have).
alter table public.coupons drop constraint if exists coupons_value_check;
alter table public.coupons add constraint coupons_value_check
  check (value > 0
         or (coalesce(free_shipping, false) and value = 0)
         or (bxgy is not null and value = 0));

DO $mig$
DECLARE
  def text;
  before text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO def
    FROM pg_proc WHERE proname = 'place_order' AND pronamespace = 'public'::regnamespace;

  -- Insert the BXGY override right after the expected-discount computation:
  -- anchor on the free-shipping flag assignment, which follows it in both the
  -- repo chain and the production copy (text from the 1050 replacement).
  before := def;
  def := replace(def,
    'v_free_ship_coupon := coalesce(v_cp.free_shipping, false);',
    '-- Buy X get Y (migration 1130): config overrides the base maths above.
    if v_cp.bxgy is not null then
      declare
        v_buy_ids   uuid[];
        v_get_ids   uuid[];
        v_buy_qty   integer;
        v_get_qty   integer;
        v_pct       numeric;
        v_max_apps  integer;
        v_buy_units integer;
        v_apps      integer;
        v_get_sum   numeric;
      begin
        v_buy_ids  := (select array_agg(x::uuid) from jsonb_array_elements_text(v_cp.bxgy->''buy_product_ids'') x);
        v_get_ids  := (select array_agg(x::uuid) from jsonb_array_elements_text(v_cp.bxgy->''get_product_ids'') x);
        v_buy_qty  := greatest(coalesce((v_cp.bxgy->>''buy_qty'')::int, 1), 1);
        v_get_qty  := greatest(coalesce((v_cp.bxgy->>''get_qty'')::int, 1), 1);
        v_pct      := least(greatest(coalesce((v_cp.bxgy->>''pct_off'')::numeric, 100), 1), 100);
        v_max_apps := greatest(coalesce((v_cp.bxgy->>''max_per_order'')::int, 1), 1);
        if v_buy_ids is null or v_get_ids is null then
          raise exception ''coupon_not_applicable'';
        end if;
        select coalesce(sum((l->>''qty'')::int), 0) into v_buy_units
          from jsonb_array_elements(v_lines) l
          where (l->>''pid'')::uuid = any(v_buy_ids);
        if v_buy_ids && v_get_ids then
          v_apps := least(v_buy_units / (v_buy_qty + v_get_qty), v_max_apps);
        else
          v_apps := least(v_buy_units / v_buy_qty, v_max_apps);
        end if;
        if v_apps < 1 then
          raise exception ''coupon_not_applicable'';
        end if;
        -- Cheapest qualifying get units, one row per unit.
        select coalesce(sum(unit_price), 0) into v_get_sum from (
          select (l->>''unit'')::numeric as unit_price
          from jsonb_array_elements(v_lines) l,
               generate_series(1, (l->>''qty'')::int)
          where (l->>''pid'')::uuid = any(v_get_ids)
          order by 1 asc
          limit (v_apps * v_get_qty)
        ) u;
        if v_get_sum <= 0 then
          raise exception ''coupon_not_applicable'';
        end if;
        v_expected_discount := round(v_get_sum * v_pct / 100);
      end;
    end if;
    v_free_ship_coupon := coalesce(v_cp.free_shipping, false);');
  IF def = before THEN RAISE EXCEPTION 'place_order patch failed: free-shipping flag anchor not found'; END IF;

  EXECUTE def;
END $mig$;
