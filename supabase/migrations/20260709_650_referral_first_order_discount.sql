-- Referral first-order discount — the missing half of the referral programme.
-- The rewards page has promised "They get 10% off their first order" since
-- launch, and the REFERRER side works (referred_by_code is stamped on the
-- profile; award_referral_for_user pays points on first delivery), but the
-- REFEREE discount was never applied anywhere. Two pieces:
--
--   1. check_referral_discount(): read-only eligibility used by the checkout
--      UI to show the discount line before submitting. Encapsulates the rules
--      so client and server can't drift.
--   2. place_order: accepts a discount WITHOUT a coupon when a valid referral
--      code is present and this is genuinely the customer's first order
--      (matched by user id, email, or phone — the same identity key the
--      Customers page groups by). Amount validated server-side against
--      site_settings.loyalty_referral_discount_pct, exactly like coupons.

-- ── 1. Eligibility check (checkout UI) ──────────────────────────────────────
create or replace function public.check_referral_discount(
  p_code    text,
  p_email   text default null,
  p_phone   text default null,
  p_user_id uuid default null
)
returns table (eligible boolean, discount_pct numeric, reason text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_pct   numeric;
begin
  select id into v_owner from public.profiles where referral_code = upper(trim(p_code));
  if v_owner is null then
    return query select false, 0::numeric, 'invalid_code'; return;
  end if;
  if p_user_id is not null and v_owner = p_user_id then
    return query select false, 0::numeric, 'self_referral'; return;
  end if;
  select coalesce(nullif(trim(value), '')::numeric, 10) into v_pct
    from public.site_settings where key = 'loyalty_referral_discount_pct';
  if v_pct is null then v_pct := 10; end if;
  if v_pct <= 0 then
    return query select false, 0::numeric, 'disabled'; return;
  end if;
  if exists (
    select 1 from public.orders o
    where o.status not in ('cancelled', 'payment_failed')
      and ((p_user_id is not null and o.user_id = p_user_id)
        or (nullif(lower(trim(p_email)), '') is not null and lower(o.email) = lower(trim(p_email)))
        or (nullif(trim(p_phone), '') is not null and o.phone = trim(p_phone)))
  ) then
    return query select false, 0::numeric, 'not_first_order'; return;
  end if;
  return query select true, v_pct, null::text;
end $$;

revoke all on function public.check_referral_discount(text, text, text, uuid) from public;
grant execute on function public.check_referral_discount(text, text, text, uuid) to anon, authenticated;

-- ── 2. place_order accepts the referral discount ────────────────────────────
-- Only the no-coupon discount branch changes vs migration 630; everything
-- else is byte-identical.
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
  v_coupon_code        text;
  v_cp                 public.coupons;
  v_expected_discount  numeric := 0;
  v_prior_uses         integer;
  v_email              text;
  v_item_ids           uuid[];
  v_free_ship_coupon   boolean := false;
  -- referral first-order discount
  v_ref_check          record;
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
    if v_status is distinct from 'published' then
      raise exception 'product % is not available', v_product_id;
    end if;

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
      if v_track then
        if v_variant_stock is null or v_variant_stock < v_qty then
          raise exception 'insufficient stock for product %: requested %, available %',
            v_product_id, v_qty, coalesce(v_variant_stock, 0);
        end if;
      end if;
    else
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

    if v_cp.type = 'percent' then
      v_expected_discount := round(v_recomputed_sub * v_cp.value / 100);
    else
      v_expected_discount := v_cp.value;
    end if;
    v_free_ship_coupon := coalesce(v_cp.free_shipping, false);

    if v_free_ship_coupon and v_cp.value = 0 then
      v_expected_discount := 0;
    end if;

    if abs(v_client_discount - v_expected_discount) > 1 then
      raise exception 'discount mismatch: server=%, client=%',
        v_expected_discount, v_client_discount;
    end if;
  elsif v_client_discount > 0
        and referred_by_code is not null and length(trim(referred_by_code)) > 0 then
    -- Referral first-order discount: no coupon, but the shopper arrived via
    -- someone's ?ref= link. Validate through the same rules the checkout UI
    -- used (check_referral_discount) so display and enforcement can't drift.
    select * into v_ref_check
      from public.check_referral_discount(
        referred_by_code,
        order_data->>'email',
        order_data->>'phone',
        v_user_id
      );
    if not coalesce(v_ref_check.eligible, false) then
      raise exception 'referral_discount_not_eligible: %', coalesce(v_ref_check.reason, 'unknown');
    end if;
    v_expected_discount := round(v_recomputed_sub * v_ref_check.discount_pct / 100);
    if abs(v_client_discount - v_expected_discount) > 1 then
      raise exception 'discount mismatch: server=%, client=%',
        v_expected_discount, v_client_discount;
    end if;
  elsif v_client_discount > 0 then
    raise exception 'discount without coupon';
  end if;

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
