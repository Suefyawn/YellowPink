-- Migration 1050 — scoped coupon discounts (Shopify "amount off products").
--
-- Before this migration a coupon's product allow/deny lists were an
-- eligibility gate only: one qualifying item in the basket and the percent
-- applied to the WHOLE subtotal ("10% off Brand X" discounted the entire
-- cart). exclude_sale_items and the legacy Woo category columns were declared
-- and enforced nowhere. Now:
--   • product_ids / excluded_product_ids / exclude_sale_items narrow the
--     discount BASE to the eligible lines: percent of that base, fixed capped
--     at it. Mirrors computeCouponDiscount in src/lib/coupon-validation.ts
--     exactly — keep the two in lock-step or the drift check rejects orders.
--   • category_ids / excluded_category_ids become an eligibility gate only
--     (matched by category name via public.categories). Deliberately never
--     part of the discount base: the client can't see category ids, so basing
--     maths on them would trip the drift check. No admin UI writes these
--     columns; this is a safety net for hand-set rows.
--   • A fixed coupon can no longer exceed its base: least(value, base).
--
-- Patched in place (the migration-1020 technique) rather than restating the
-- 16 KB body that later migrations have already amended textually. Each edit
-- asserts it matched, so a drifted function makes this fail loudly.

DO $mig$
DECLARE
  def text;
  before text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO def
    FROM pg_proc WHERE proname = 'place_order' AND pronamespace = 'public'::regnamespace;

  -- 1. declare the line-collection + scoping locals
  before := def;
  def := replace(def,
    '  v_free_ship_coupon   boolean := false;',
    '  v_free_ship_coupon   boolean := false;' || chr(10) ||
    '  -- scoped coupon discounts (migration 1050): per-line facts collected in' || chr(10) ||
    '  -- the items loop so the coupon block can compute the eligible subtotal.' || chr(10) ||
    '  v_orig_price         numeric;' || chr(10) ||
    '  v_prod_category      text;' || chr(10) ||
    '  v_lines              jsonb := ''[]''::jsonb;' || chr(10) ||
    '  v_coupon_scoped      boolean := false;' || chr(10) ||
    '  v_eligible_sub       numeric := 0;');
  IF def = before THEN RAISE EXCEPTION 'place_order patch 1/4 failed: v_free_ship_coupon declaration not found'; END IF;

  -- 2. load original_price + category alongside the other product columns
  --    (this is the post-migration-1020 shape of the select).
  before := def;
  def := replace(def,
    'select stock, price, coalesce(track_inventory, true), status, vendor_id, coalesce(continue_selling_when_out, true)
      into v_stock, v_unit_price, v_track, v_status, v_vendor_id, v_continue',
    'select stock, price, coalesce(track_inventory, true), status, vendor_id, coalesce(continue_selling_when_out, true), original_price, category
      into v_stock, v_unit_price, v_track, v_status, v_vendor_id, v_continue, v_orig_price, v_prod_category');
  IF def = before THEN RAISE EXCEPTION 'place_order patch 2/4 failed: product select not found'; END IF;

  -- 3. collect the line facts. ''unit'' is the charged price (variant price on
  --    shade lines), matching the client''s cart-line price.
  before := def;
  def := replace(def,
    'v_recomputed_sub := v_recomputed_sub + (v_unit_price * v_qty);',
    'v_recomputed_sub := v_recomputed_sub + (v_unit_price * v_qty);' || chr(10) ||
    '    v_lines := v_lines || jsonb_build_object(' || chr(10) ||
    '      ''pid'',  v_product_id,' || chr(10) ||
    '      ''unit'', v_unit_price,' || chr(10) ||
    '      ''qty'',  v_qty,' || chr(10) ||
    '      ''orig'', v_orig_price,' || chr(10) ||
    '      ''cat'',  v_prod_category' || chr(10) ||
    '    );');
  IF def = before THEN RAISE EXCEPTION 'place_order patch 3/4 failed: subtotal accumulation not found'; END IF;

  -- 4. category gates + scoped discount base, replacing the whole-subtotal
  --    maths. The match string is comment-free on purpose: the production
  --    copy of the function was applied without the repo file's comments, so
  --    matching a comment would work in CI and fail against production.
  before := def;
  def := replace(def,
    'if v_cp.type = ''percent'' then
      v_expected_discount := round(v_recomputed_sub * v_cp.value / 100);
    else
      v_expected_discount := v_cp.value;
    end if;',
    '-- Category allow/deny (legacy Woo columns, no admin UI writes them):
    -- eligibility gate only, matched by category NAME via public.categories.
    -- Never part of the discount base — the client cannot see category ids,
    -- so basing maths on them would trip the drift check below.
    if array_length(v_cp.category_ids, 1) > 0 then
      if not exists (
        select 1 from jsonb_array_elements(v_lines) l
        where (l->>''cat'') in (select name from public.categories where id = any(v_cp.category_ids))
      ) then
        raise exception ''coupon_not_applicable'';
      end if;
    end if;
    if array_length(v_cp.excluded_category_ids, 1) > 0 then
      if not exists (
        select 1 from jsonb_array_elements(v_lines) l
        where coalesce(l->>''cat'', '''') not in
          (select name from public.categories where id = any(v_cp.excluded_category_ids))
      ) then
        raise exception ''coupon_not_applicable'';
      end if;
    end if;

    -- Discount base (migration 1050): a coupon scoped to certain products, or
    -- barring sale items, discounts only the lines it applies to — Shopify''s
    -- "amount off products". Unscoped coupons keep the whole-subtotal base.
    -- Mirrors computeCouponDiscount in src/lib/coupon-validation.ts exactly.
    v_coupon_scoped :=
         coalesce(array_length(v_cp.product_ids, 1), 0) > 0
      or coalesce(array_length(v_cp.excluded_product_ids, 1), 0) > 0
      or coalesce(v_cp.exclude_sale_items, false);
    if v_coupon_scoped then
      select coalesce(sum((l->>''unit'')::numeric * (l->>''qty'')::integer), 0)
        into v_eligible_sub
        from jsonb_array_elements(v_lines) l
        where (array_length(v_cp.product_ids, 1) is null
               or (l->>''pid'')::uuid = any(v_cp.product_ids))
          and (array_length(v_cp.excluded_product_ids, 1) is null
               or not ((l->>''pid'')::uuid = any(v_cp.excluded_product_ids)))
          and (not coalesce(v_cp.exclude_sale_items, false)
               or nullif(l->>''orig'', '''') is null
               or (l->>''orig'')::numeric <= (l->>''unit'')::numeric);
      if v_eligible_sub <= 0 then
        raise exception ''coupon_not_applicable'';
      end if;
    else
      v_eligible_sub := v_recomputed_sub;
    end if;

    -- Expected discount, exactly as the storefront computes it.
    if v_cp.type = ''percent'' then
      v_expected_discount := round(v_eligible_sub * v_cp.value / 100);
    else
      -- Fixed amount: never more than the lines it may touch.
      v_expected_discount := least(v_cp.value, v_eligible_sub);
    end if;');
  IF def = before THEN RAISE EXCEPTION 'place_order patch 4/4 failed: coupon discount block not found'; END IF;

  EXECUTE def;
END $mig$;
