-- ============================================================================
-- Replay the place_order in-place patches that migration 1240 wiped. 2026-09-04.
--
-- 20260901_1240 restated place_order in full from the 20260731_800 body
-- ("with the one threshold change"). Between 800 and 1240 four migrations had
-- amended that body IN PLACE with DO-block text patches, and none of them
-- were in 1240's text, so all four vanished from production and from the
-- from-scratch chain the moment 1240 ran:
--
--   1020  keep-selling products may oversell (continue_selling_when_out)
--   1050  scoped coupon discounts (product allow/deny, exclude sale items)
--   1060  coupon start dates (restored separately in 20260904_1310)
--   1130  Buy X Get Y discounts
--
-- Live effect since 1 Sep: an own-stock keep-selling product at zero was
-- refused at checkout ("insufficient stock"); any coupon scoped to products
-- or excluding sale items failed with "discount mismatch" (the storefront
-- computes the scoped base, the function computed the whole-subtotal base);
-- every BXGY offer failed the same way; scheduled codes were accepted early.
-- The place_order forgery matrix (supabase/tests/place_order_matrix.sql)
-- catches all of it — it had not run since 1 Sep because the chain broke
-- earlier on a missing function (20260901_1229).
--
-- The three DO blocks below are the 1020, 1050 and 1130 blocks verbatim,
-- each with an idempotency guard so the chain replays cleanly whether or not
-- the patch is already present. Order matters: 1050 anchors on the
-- post-1020 product select; 1130 anchors on the free-shipping flag line.
--
-- RULE for future work: never restate place_order in full without carrying
-- these blocks; patch in place, or fold every patch into the new body.
-- ============================================================================

-- ── 1020: keep-selling gate ─────────────────────────────────────────────────
DO $mig$
DECLARE
  def text;
  before text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO def
    FROM pg_proc WHERE proname = 'place_order' AND pronamespace = 'public'::regnamespace;

  IF position('v_continue' IN def) > 0 THEN
    RAISE NOTICE 'place_order already carries the 1020 keep-selling patch; skipping';
    RETURN;
  END IF;

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

-- ── 1050: scoped coupon discounts ───────────────────────────────────────────
DO $mig$
DECLARE
  def text;
  before text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO def
    FROM pg_proc WHERE proname = 'place_order' AND pronamespace = 'public'::regnamespace;

  IF position('v_eligible_sub' IN def) > 0 THEN
    RAISE NOTICE 'place_order already carries the 1050 scoped-discount patch; skipping';
    RETURN;
  END IF;

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

-- ── 1130: Buy X Get Y ───────────────────────────────────────────────────────
DO $mig$
DECLARE
  def text;
  before text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO def
    FROM pg_proc WHERE proname = 'place_order' AND pronamespace = 'public'::regnamespace;

  IF position('v_cp.bxgy' IN def) > 0 THEN
    RAISE NOTICE 'place_order already carries the 1130 BXGY patch; skipping';
    RETURN;
  END IF;

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
