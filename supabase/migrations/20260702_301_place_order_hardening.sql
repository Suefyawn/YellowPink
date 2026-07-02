-- ============================================================================
-- place_order hardening. Audit 2026-07-02, addresses four confirmed defects
-- in the 20260616_137 version of the RPC (the live one):
--
--   1. CRITICAL: `discount_amount` was trusted from the client. Any caller
--      could pass discount = subtotal (with or without a coupon code) and
--      place a near-free order. The coupon was never validated server-side
--      (client validation in lib/coupon-validation.ts was explicitly marked
--      "server-side re-validation tracked as a P1 follow-up" — this is it).
--   2. `shipping` was trusted from the client — passing 0 skipped delivery
--      charges. Now recomputed from province_zones/shipping_rates +
--      site_settings, mirroring lib/shipping.ts. Only undercharges reject.
--   3. Non-published (draft/archived) products could be ordered, and
--      track_inventory=false products were wrongly stock-gated (regression
--      of migration 108) and had stock decremented.
--   4. Stock decrement bypassed the inventory ledger (regression of
--      migration 079) and coupon_redemptions was never written, making
--      per-user coupon caps unenforceable.
--
-- Client behaviour contract (must not produce false rejections):
--   * discount   = percent: round(subtotal * value / 100)   (full subtotal)
--                  fixed:   value                            (≤ subtotal)
--   * shipping   = zone min-rate by province, free at/above the zone (or
--                  default) threshold vs the PRE-discount subtotal.
--   * category-restriction enforcement is deliberately NOT added: the client
--     validator skips it (no category id on CartItem), so enforcing it here
--     would reject carts the storefront accepted.
-- ============================================================================

-- The original single-argument overload (migration 002) was dropped in
-- production but never via a migration; drop it here so a from-scratch
-- database matches production and one-argument calls aren't ambiguous.
drop function if exists public.place_order(jsonb);

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
  v_qty                integer;
  v_stock              integer;
  v_unit_price         numeric;
  v_track              boolean;
  v_status             text;
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

  for v_item in select * from jsonb_array_elements(order_data->'items') loop
    v_product_id := (v_item->>'id')::uuid;
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
    -- Stock-gate only inventory-tracked products (migration 108 semantics):
    -- externally-stocked items (track_inventory=false) always sell.
    if v_track then
      if v_stock is null or v_stock < v_qty then
        raise exception 'insufficient stock for product %: requested %, available %',
          v_product_id, v_qty, coalesce(v_stock, 0);
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

  -- Decrement stock through the ledger (migration 079 semantics restored):
  -- tracked products only; record_stock_change updates products.stock AND
  -- writes the inventory_ledger row in one call.
  for v_item in select * from jsonb_array_elements(order_data->'items') loop
    v_product_id := (v_item->>'id')::uuid;
    select coalesce(track_inventory, true) into v_track
      from public.products where id = v_product_id;
    if v_track then
      perform public.record_stock_change(
        v_product_id, null,
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
