-- ============================================================================
-- Variant-aware ordering. Audit 2026-07-09, fixes two CRITICAL checkout
-- defects for variable (multi-shade) products:
--
--   1. place_order recomputed the subtotal from products.price only, never
--      product_variants.price — any product whose variant price differs from
--      the parent price was rejected with 'subtotal mismatch' on every
--      checkout (4 live products affected; one 100% unbuyable).
--   2. Stock was gated and debited on the PARENT product (variant_id was
--      hardcoded null in the debit), while cancellation/return restocks pass
--      the variant id — so parent and variant stock drifted apart on every
--      cancelled variant order, and a variant order could oversell a shade
--      or brick a whole product once the parent counter ran out.
--
-- Two changes, designed together:
--
--   A. record_stock_change: when BOTH p_product_id and p_variant_id are
--      provided, move BOTH balances (variant + parent) in the same call and
--      the same ledger row. Every existing caller already passes both ids
--      (order debit below, admin cancel restock, customer-return restock,
--      admin inventory adjustment), so parent stock now tracks the sum of
--      variant movements instead of silently diverging. The returned
--      balance_after stays the variant's balance when a variant is involved.
--      Keeps migration 300's contract: the ledger records the APPLIED delta
--      (clamped at zero) and the function returns applied_delta so the admin
--      adjustment action can warn on a clamp. DROP + CREATE like 300 (the
--      OUT row type is part of the signature), grants re-applied below.
--
--   B. place_order: for items carrying a variant_id — price comes from the
--      variant row, the stock gate checks the variant's stock, the variant
--      must be enabled and belong to the claimed product, and the debit
--      passes the variant id through. Simple products are unchanged.
-- ============================================================================

-- ── A. record_stock_change moves both balances when both ids are given ─────
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

  -- The delta the (variant or product) stock scalar actually moved by.
  -- Differs from p_qty_delta only when the removal was clamped at zero.
  v_applied := v_new_balance - COALESCE(v_old_balance, 0);
  v_note    := p_note;
  IF v_applied <> p_qty_delta THEN
    v_note := COALESCE(v_note || ' — ', '')
      || format('clamped at zero stock: requested %s, applied %s', p_qty_delta, v_applied);
  END IF;

  -- Keep the parent's aggregate counter in step with the variant movement,
  -- one physical unit = one delta on both levels, same ledger row. This is
  -- what makes grid-level "sold out" (which reads products.stock) truthful
  -- for variable products. The parent moves by the APPLIED (clamped) delta
  -- so the two levels never drift by a clamp.
  IF p_variant_id IS NOT NULL AND p_product_id IS NOT NULL THEN
    UPDATE public.products
       SET stock = GREATEST(0, stock + v_applied)
     WHERE id = p_product_id;
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

-- ── B. Variant-aware place_order ────────────────────────────────────────────
create or replace function public.place_order(
  order_data       jsonb,
  gift_card_code   text default null,
  points_redeem    integer default null,
  referred_by_code text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order              public.orders;
  v_item               jsonb;
  v_product_id         uuid;
  v_variant_id         uuid;
  v_qty                integer;
  v_stock              integer;
  v_unit_price         numeric;
  v_track              boolean;
  v_status             text;
  v_variant_price      numeric;
  v_variant_stock      integer;
  v_variant_enabled    boolean;
  v_variant_product    uuid;
  v_payment            text;
  v_user_id            uuid;
  v_gc_taken           numeric := 0;
  v_recomputed_sub     numeric := 0;
  v_client_sub         numeric;
  v_client_total       numeric;
  v_client_shipping    numeric;
  v_client_discount    numeric;
  -- coupon validation
  v_coupon_code        text;
  v_cp                 public.coupons;
  v_expected_discount  numeric := 0;
  v_prior_uses         integer;
  v_email              text;
  v_item_ids           uuid[];
  v_free_ship_coupon   boolean := false;
  -- shipping validation
  v_settings           jsonb;
  v_free_enabled       boolean;
  v_default_threshold  numeric;
  v_default_rate       numeric;
  v_zone_id            uuid;
  v_zone_rate          numeric;
  v_zone_threshold     numeric;
  v_expected_rate      numeric;
begin
  if order_data is null or jsonb_typeof(order_data->'items') <> 'array' then
    raise exception 'order_data.items must be an array';
  end if;
  if jsonb_array_length(order_data->'items') = 0 then
    raise exception 'cart is empty';
  end if;

  v_payment := order_data->>'pay_method';
  if v_payment not in ('cod','card','bank','jazzcash','easypaisa','gift_card') then
    raise exception 'invalid pay_method: %', v_payment;
  end if;

  v_user_id := nullif(order_data->>'user_id', '')::uuid;
  v_email   := lower(nullif(order_data->>'email', ''));

  perform 1
  from public.products
  where id = any (
    select (i->>'id')::uuid
    from jsonb_array_elements(order_data->'items') i
    order by 1
  )
  for update;

  -- Lock the variant rows too (deterministic order, same as products) so two
  -- concurrent checkouts of the same shade serialize on the stock gate.
  perform 1
  from public.product_variants
  where id = any (
    select (i->>'variant_id')::uuid
    from jsonb_array_elements(order_data->'items') i
    where nullif(i->>'variant_id','') is not null
    order by 1
  )
  for update;

  for v_item in select * from jsonb_array_elements(order_data->'items') loop
    v_product_id := (v_item->>'id')::uuid;
    v_variant_id := nullif(v_item->>'variant_id','')::uuid;
    v_qty        := coalesce((v_item->>'qty')::integer, 0);
    if v_qty <= 0 then raise exception 'invalid quantity for product %', v_product_id; end if;
    if v_qty > 500 then raise exception 'quantity too large for product %', v_product_id; end if;

    select stock, price, coalesce(track_inventory, true), status
      into v_stock, v_unit_price, v_track, v_status
      from public.products where id = v_product_id;
    if v_unit_price is null then raise exception 'product % not found', v_product_id; end if;
    -- Draft/archived products have no live PDP and must not be orderable.
    if v_status is distinct from 'published' then
      raise exception 'product % is not available', v_product_id;
    end if;

    -- Variant line: the shade's own price and stock are authoritative — the
    -- PDP charges product_variants.price, so the server must recompute from
    -- the same source or every differing-price variant rejects at checkout.
    if v_variant_id is not null then
      select price, stock, enabled, product_id
        into v_variant_price, v_variant_stock, v_variant_enabled, v_variant_product
        from public.product_variants where id = v_variant_id;
      if v_variant_product is null then
        raise exception 'variant % not found', v_variant_id;
      end if;
      if v_variant_product <> v_product_id then
        raise exception 'variant % does not belong to product %', v_variant_id, v_product_id;
      end if;
      if not v_variant_enabled then
        raise exception 'product % is not available', v_product_id;
      end if;
      if coalesce(v_variant_price, 0) > 0 then
        v_unit_price := v_variant_price;
      end if;
      -- Gate on the shade's stock, not the parent counter: the parent is an
      -- aggregate and can be non-zero while this specific shade is sold out
      -- (and vice versa).
      if v_track then
        if v_variant_stock is null or v_variant_stock < v_qty then
          raise exception 'insufficient stock for product %: requested %, available %',
            v_product_id, v_qty, coalesce(v_variant_stock, 0);
        end if;
      end if;
    else
      -- Stock-gate only inventory-tracked products (migration 108 semantics):
      -- externally-stocked items (track_inventory=false) always sell.
      if v_track then
        if v_stock is null or v_stock < v_qty then
          raise exception 'insufficient stock for product %: requested %, available %',
            v_product_id, v_qty, coalesce(v_stock, 0);
        end if;
      end if;
    end if;
    v_recomputed_sub := v_recomputed_sub + (v_unit_price * v_qty);
  end loop;

  v_client_sub      := coalesce((order_data->>'subtotal')::numeric, 0);
  v_client_shipping := coalesce((order_data->>'shipping')::numeric, 0);
  v_client_discount := coalesce((order_data->>'discount_amount')::numeric, 0);
  v_client_total    := coalesce((order_data->>'total')::numeric, 0);
  v_coupon_code     := nullif(trim(order_data->>'coupon_code'), '');

  if v_client_shipping < 0 then raise exception 'shipping cannot be negative'; end if;
  if v_client_discount < 0 then raise exception 'discount cannot be negative'; end if;
  if v_client_discount > v_recomputed_sub then
    raise exception 'discount % exceeds subtotal %', v_client_discount, v_recomputed_sub;
  end if;

  if abs(v_recomputed_sub - v_client_sub) > 0.01 then
    raise exception 'subtotal mismatch: server=%, client=%', v_recomputed_sub, v_client_sub;
  end if;

  -- ── Server-side coupon validation ─────────────────────────────────────────
  if v_coupon_code is not null then
    select * into v_cp from public.coupons where upper(code) = upper(v_coupon_code);
    if not found then raise exception 'coupon_invalid'; end if;
    if not v_cp.active then raise exception 'coupon_invalid'; end if;
    if v_cp.expires_at is not null and v_cp.expires_at < now() then
      raise exception 'coupon_expired';
    end if;
    if v_cp.max_uses is not null and v_cp.used_count >= v_cp.max_uses then
      raise exception 'coupon_limit_reached';
    end if;
    if v_recomputed_sub < coalesce(v_cp.min_order, 0) then
      raise exception 'coupon_min_order_not_met';
    end if;
    if v_cp.max_order is not null and v_cp.max_order > 0 and v_recomputed_sub > v_cp.max_order then
      raise exception 'coupon_max_order_exceeded';
    end if;

    -- Per-user cap (user_id first, else email). Enforceable now that
    -- redemptions are recorded again below.
    if coalesce(v_cp.usage_limit_per_user, 0) > 0 then
      select count(*) into v_prior_uses
        from public.coupon_redemptions r
        where r.coupon_id = v_cp.id
          and ((v_user_id is not null and r.user_id = v_user_id)
            or (v_user_id is null and v_email is not null and lower(r.email) = v_email));
      if v_prior_uses >= v_cp.usage_limit_per_user then
        raise exception 'coupon_limit_reached';
      end if;
    end if;

    -- Email allowlist (exact or *@domain wildcard, mirrors client).
    if array_length(v_cp.email_restrictions, 1) > 0 then
      if v_email is null then raise exception 'coupon_email_required'; end if;
      if not exists (
        select 1 from unnest(v_cp.email_restrictions) r
        where (r like '*@%' and v_email like '%' || lower(substr(r, 2)))
           or lower(trim(r)) = v_email
      ) then
        raise exception 'coupon_email_not_allowed';
      end if;
    end if;

    -- Product allow/deny lists (eligibility, mirrors client).
    select array_agg((i->>'id')::uuid)
      into v_item_ids from jsonb_array_elements(order_data->'items') i;
    if array_length(v_cp.product_ids, 1) > 0
       and not (v_item_ids && v_cp.product_ids) then
      raise exception 'coupon_not_applicable';
    end if;
    if array_length(v_cp.excluded_product_ids, 1) > 0
       and v_item_ids <@ v_cp.excluded_product_ids then
      raise exception 'coupon_not_applicable';
    end if;

    -- Expected discount, exactly as the storefront computes it.
    if v_cp.type = 'percent' then
      v_expected_discount := round(v_recomputed_sub * v_cp.value / 100);
    else
      v_expected_discount := v_cp.value;
    end if;
    v_free_ship_coupon := coalesce(v_cp.free_shipping, false);

    -- Free-shipping-only coupons may carry no line discount.
    if v_free_ship_coupon and v_cp.value = 0 then
      v_expected_discount := 0;
    end if;

    if abs(v_client_discount - v_expected_discount) > 1 then
      raise exception 'discount mismatch: server=%, client=%',
        v_expected_discount, v_client_discount;
    end if;
  elsif v_client_discount > 0 then
    -- No coupon → no discount. Loyalty points and gift cards are handled by
    -- their own parameters and never flow through discount_amount.
    raise exception 'discount without coupon';
  end if;

  -- ── Server-side shipping floor (mirror of lib/shipping.ts) ────────────────
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_settings
    from public.site_settings
    where key in ('free_shipping_enabled','free_shipping_threshold','default_shipping_rate');
  v_free_enabled      := coalesce(v_settings->>'free_shipping_enabled', 'true') <> 'false';
  v_default_threshold := coalesce(nullif(v_settings->>'free_shipping_threshold','')::numeric, 5000);
  v_default_rate      := coalesce(nullif(v_settings->>'default_shipping_rate','')::numeric, 200);

  select pz.zone_id into v_zone_id
    from public.province_zones pz
    where pz.province = nullif(order_data->>'province','')
    limit 1;
  if v_zone_id is null then
    select z.id into v_zone_id from public.shipping_zones z
      where z.active order by z.sort_order limit 1;
  end if;
  if v_zone_id is not null then
    select r.rate, r.free_shipping_threshold into v_zone_rate, v_zone_threshold
      from public.shipping_rates r
      where r.zone_id = v_zone_id
      order by r.rate asc limit 1;
  end if;
  v_zone_rate      := coalesce(v_zone_rate, v_default_rate);
  v_zone_threshold := coalesce(v_zone_threshold, v_default_threshold);

  if v_free_ship_coupon
     or (v_free_enabled and v_recomputed_sub >= v_zone_threshold) then
    v_expected_rate := 0;
  else
    v_expected_rate := v_zone_rate;
  end if;
  -- Reject undercharged shipping only; a higher client value (e.g. a slower
  -- fallback quote) is harmless and accepted. The floor is the LOWER of the
  -- zone rate and the default rate: the storefront legitimately quotes the
  -- default while the async zone lookup is in flight, so a stricter floor
  -- would reject real checkouts in remote zones.
  if v_expected_rate > 0 then
    v_expected_rate := least(v_expected_rate, v_default_rate);
  end if;
  if v_client_shipping < v_expected_rate - 0.01 then
    raise exception 'shipping mismatch: server=%, client=%', v_expected_rate, v_client_shipping;
  end if;

  if abs(v_client_total - (v_recomputed_sub + v_client_shipping - v_client_discount)) > 0.01 then
    raise exception 'total mismatch: server=%, client=%',
      v_recomputed_sub + v_client_shipping - v_client_discount, v_client_total;
  end if;

  if v_user_id is not null and referred_by_code is not null and length(trim(referred_by_code)) > 0 then
    update public.profiles
      set referred_by_code = upper(trim(referred_by_code))
      where id = v_user_id and (referred_by_code is null or referred_by_code = '');
  end if;

  insert into public.orders (
    order_number, email, first_name, last_name, phone,
    address, city, province, zip,
    pay_method, subtotal, shipping, total,
    items, status, user_id, coupon_code, discount_amount,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, landing_page, referrer
  ) values (
    order_data->>'order_number',
    nullif(order_data->>'email', ''),
    order_data->>'first_name',
    order_data->>'last_name',
    order_data->>'phone',
    order_data->>'address',
    order_data->>'city',
    nullif(order_data->>'province', ''),
    nullif(order_data->>'zip', ''),
    v_payment,
    v_recomputed_sub,
    v_client_shipping,
    v_recomputed_sub + v_client_shipping - v_client_discount,
    order_data->'items',
    case when v_payment in ('cod','gift_card') then 'pending' else 'payment_pending' end,
    v_user_id,
    v_coupon_code,
    v_client_discount,
    nullif(order_data->>'utm_source', ''),
    nullif(order_data->>'utm_medium', ''),
    nullif(order_data->>'utm_campaign', ''),
    nullif(order_data->>'utm_content', ''),
    nullif(order_data->>'utm_term', ''),
    nullif(order_data->>'landing_page', ''),
    nullif(order_data->>'referrer', '')
  )
  returning * into v_order;

  -- Decrement stock through the ledger: tracked products only. For variant
  -- lines the variant id is passed through, which (per the updated
  -- record_stock_change above) moves the shade's stock AND the parent's
  -- aggregate counter together — the exact mirror of the cancel/return
  -- restock paths, which already pass the variant id.
  for v_item in select * from jsonb_array_elements(order_data->'items') loop
    v_product_id := (v_item->>'id')::uuid;
    v_variant_id := nullif(v_item->>'variant_id','')::uuid;
    select coalesce(track_inventory, true) into v_track
      from public.products where id = v_product_id;
    if v_track then
      perform public.record_stock_change(
        v_product_id, v_variant_id,
        -((v_item->>'qty')::integer),
        'order'::inventory_reason,
        v_order.id, null, 'system', null,
        'Order ' || (order_data->>'order_number')
      );
    end if;
  end loop;

  if v_cp.id is not null then
    update public.coupons set used_count = used_count + 1 where id = v_cp.id;
    insert into public.coupon_redemptions (coupon_id, user_id, email, order_id, amount)
    values (v_cp.id, v_user_id, v_email, v_order.id, v_client_discount);
  end if;

  if gift_card_code is not null and length(trim(gift_card_code)) > 0 then
    v_gc_taken := public.redeem_gift_card(gift_card_code, v_order.total, v_order.id);
    insert into public.payments (order_id, gateway, amount, status, txn_ref)
    values (v_order.id, 'gift_card', v_gc_taken, 'succeeded', upper(trim(gift_card_code)));
  end if;

  if v_user_id is not null and points_redeem is not null and points_redeem > 0 then
    perform public.redeem_loyalty_points(v_user_id, points_redeem, v_order.id);
  end if;

  return v_order;
end;
$$;
