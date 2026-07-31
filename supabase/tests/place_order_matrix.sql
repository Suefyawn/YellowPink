-- ============================================================================
-- Regression suite for public.place_order (migration 20260702_301).
--
-- Mirrors the forgery matrix used to verify the 2026-07-02 hardening: the
-- pre-301 RPC trusted client-sent discount_amount and shipping, let drafts
-- and out-of-stock items be ordered, skipped the inventory ledger and never
-- recorded coupon redemptions. Every case here failed (or silently
-- undercharged) on the old function — if one starts failing again, the
-- hardening has regressed.
--
-- Plain SQL driven by psql, no pgTAP: rejection cases run place_order inside
-- an EXCEPTION block and require the expected error text; a wrong/absent
-- error raises TEST FAIL, which aborts the run under -v ON_ERROR_STOP=1.
-- Run order matters (stock and coupon counters accumulate); the suite is
-- meant for a throwaway database built by supabase-prelude.sql + the full
-- migration chain. See supabase/tests/supabase-prelude.sql for the recipe.
-- ============================================================================

\set ON_ERROR_STOP 1

begin;

-- ── Seed ─────────────────────────────────────────────────────────────────────
-- Fixed UUIDs so payloads below stay readable.
--   …00a  tracked product, plenty of stock  (price 1000)
--   …00b  tracked product, stock 3          (price 500)
--   …00c  untracked product, stock 0        (price 800)
--   …00d  draft product                     (price 100)
insert into public.products (id, name, slug, category, price, stock, track_inventory, status) values
  ('00000000-0000-0000-0000-00000000000a', 'Matrix Tracked A',  'matrix-tracked-a',  'Test', 1000, 1000, true,  'published'),
  ('00000000-0000-0000-0000-00000000000b', 'Matrix Tracked B',  'matrix-tracked-b',  'Test',  500,    3, true,  'published'),
  ('00000000-0000-0000-0000-00000000000c', 'Matrix External C', 'matrix-external-c', 'Test',  800,    0, false, 'published'),
  ('00000000-0000-0000-0000-00000000000d', 'Matrix Draft D',    'matrix-draft-d',    'Test',  100,  100, true,  'draft');

-- Vendor free-shipping rule (migration 770): vendor V free-ships from 1999;
-- product E belongs to it (price 1000, so 2 × E qualifies, 1 × E doesn't).
insert into public.vendors (id, name, phone, free_shipping_threshold)
  values ('00000000-0000-0000-0000-0000000000f1', 'Matrix Vendor', '03000000001', 1999);
insert into public.products (id, name, slug, category, price, stock, track_inventory, status, vendor_id) values
  ('00000000-0000-0000-0000-00000000000e', 'Matrix Vendored E', 'matrix-vendored-e', 'Test', 1000, 1000, true, 'published',
   '00000000-0000-0000-0000-0000000000f1');

insert into public.coupons (id, code, type, value, active, expires_at, usage_limit_per_user, free_shipping) values
  ('00000000-0000-0000-0000-0000000000c1', 'MATRIX10',   'percent', 10, true,  null,                 null, false),
  ('00000000-0000-0000-0000-0000000000c2', 'MATRIXOLD',  'percent', 10, true,  now() - interval '1 day', null, false),
  ('00000000-0000-0000-0000-0000000000c3', 'MATRIXONCE', 'fixed',  100, true,  null,                 1,    false),
  ('00000000-0000-0000-0000-0000000000c4', 'MATRIXSHIP', 'fixed',    0, true,  null,                 null, true);

-- Referral programme: a referrer profile whose code a first-time buyer can
-- use for the no-coupon referral discount (migration 650, restored by 790).
insert into auth.users (id, email)
  values ('00000000-0000-0000-0000-0000000000f1', 'matrix-referrer@example.com')
  on conflict (id) do nothing;
insert into public.profiles (id, referral_code)
  values ('00000000-0000-0000-0000-0000000000f1', 'MATRIXREF')
  on conflict (id) do update set referral_code = excluded.referral_code;
insert into public.site_settings (key, value) values ('loyalty_referral_discount_pct', '10')
  on conflict (key) do update set value = excluded.value;

-- Loyalty redemption (migration 800): a signed-in buyer with a points balance.
insert into auth.users (id, email)
  values ('00000000-0000-0000-0000-0000000000f2', 'matrix-loyal@example.com')
  on conflict (id) do nothing;
insert into public.profiles (id) values ('00000000-0000-0000-0000-0000000000f2')
  on conflict (id) do nothing;
select public.grant_loyalty_points('00000000-0000-0000-0000-0000000000f2', 500, 'manual', null, 'matrix seed');

-- Shipping: zone rate 250 with free-shipping threshold 5000; store default
-- rate 200 / threshold 5000. place_order floors at least(zone, default)=200.
insert into public.site_settings (key, value) values
  ('free_shipping_enabled',   'true'),
  ('free_shipping_threshold', '5000'),
  ('default_shipping_rate',   '200')
on conflict (key) do update set value = excluded.value;

insert into public.shipping_zones (id, name, sort_order, active)
  values ('00000000-0000-0000-0000-0000000000e1', 'Matrix Zone', 0, true);
insert into public.shipping_rates (zone_id, rate, free_shipping_threshold, label)
  values ('00000000-0000-0000-0000-0000000000e1', 250, 5000, 'Matrix Standard');
insert into public.province_zones (province, zone_id)
  values ('Matrixland', '00000000-0000-0000-0000-0000000000e1');

-- ── Harness ──────────────────────────────────────────────────────────────────
create schema if not exists yp_tests;

-- Base legit payload: 2 × product A = 2000, below the free-shipping
-- threshold, shipping 200, no coupon. Cases override individual keys.
create or replace function yp_tests.payload(overrides jsonb default '{}'::jsonb)
returns jsonb language sql as $$
  select jsonb_build_object(
    'order_number', 'MTX-' || substr(md5(overrides::text), 1, 12),
    'email',        'matrix@example.com',
    'first_name',   'Matrix', 'last_name', 'Test',
    'phone',        '03000000000',
    'address',      '1 Test Street', 'city', 'Testville',
    'province',     'Matrixland', 'zip', '00000',
    'pay_method',   'cod',
    'items',        jsonb_build_array(jsonb_build_object('id', '00000000-0000-0000-0000-00000000000a', 'qty', 2)),
    'subtotal', 2000, 'shipping', 200, 'discount_amount', 0, 'total', 2200
  ) || overrides
$$;

-- Expect place_order to reject with an error containing `expected`.
create or replace function yp_tests.expect_reject(case_name text, p jsonb, expected text)
returns void language plpgsql as $$
begin
  perform public.place_order(p);
  raise exception 'TEST FAIL [%]: order was accepted, expected error ~ "%"', case_name, expected;
exception
  when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    if position(expected in sqlerrm) = 0 then
      raise exception 'TEST FAIL [%]: expected error ~ "%", got "%"', case_name, expected, sqlerrm;
    end if;
    raise notice 'ok (rejected): % — %', case_name, sqlerrm;
end $$;

create or replace function yp_tests.expect_ok(case_name text, p jsonb)
returns public.orders language plpgsql as $$
declare o public.orders;
begin
  o := public.place_order(p);
  raise notice 'ok (placed): % — % total %', case_name, o.order_number, o.total;
  return o;
exception
  when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise exception 'TEST FAIL [%]: expected success, got "%"', case_name, sqlerrm;
end $$;

create or replace function yp_tests.assert(case_name text, cond boolean, detail text)
returns void language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'TEST FAIL [%]: %', case_name, detail;
  end if;
  raise notice 'ok (assert): % — %', case_name, detail;
end $$;

-- ── The matrix ───────────────────────────────────────────────────────────────
do $$
declare
  o public.orders;
  v_stock integer;
begin
  -- 1. Legit COD order: accepted, totals recomputed server-side, stock
  --    decremented THROUGH the ledger.
  o := yp_tests.expect_ok('legit order', yp_tests.payload());
  perform yp_tests.assert('legit order', o.subtotal = 2000 and o.shipping = 200 and o.total = 2200,
    'server-recomputed totals 2000/200/2200');
  select stock into v_stock from public.products where id = '00000000-0000-0000-0000-00000000000a';
  perform yp_tests.assert('legit order', v_stock = 998, 'stock 1000 → 998');
  perform yp_tests.assert('legit order', exists (
      select 1 from public.inventory_ledger
      where order_id = o.id and product_id = '00000000-0000-0000-0000-00000000000a'
        and qty_delta = -2 and reason = 'order'),
    'inventory_ledger row written (qty -2, reason order)');

  -- 2. Forged discount with no coupon (the original CRITICAL hole).
  perform yp_tests.expect_reject('forged discount, no coupon',
    yp_tests.payload('{"discount_amount": 500, "total": 1700}'),
    'discount without coupon');

  -- 3. Discount exceeding the subtotal.
  perform yp_tests.expect_reject('discount > subtotal',
    yp_tests.payload('{"discount_amount": 2500, "total": -300}'),
    'exceeds subtotal');

  -- 4. Negative discount.
  perform yp_tests.expect_reject('negative discount',
    yp_tests.payload('{"discount_amount": -50, "total": 2250}'),
    'discount cannot be negative');

  -- 5. Real coupon, inflated discount (10% of 2000 is 200, client claims 1000).
  perform yp_tests.expect_reject('coupon with inflated discount',
    yp_tests.payload('{"coupon_code": "MATRIX10", "discount_amount": 1000, "total": 1200}'),
    'discount mismatch');

  -- 6. Real coupon, honest discount: accepted + redemption recorded.
  o := yp_tests.expect_ok('valid percent coupon',
    yp_tests.payload('{"coupon_code": "MATRIX10", "discount_amount": 200, "total": 2000}'));
  perform yp_tests.assert('valid percent coupon', exists (
      select 1 from public.coupon_redemptions r
      where r.order_id = o.id and r.coupon_id = '00000000-0000-0000-0000-0000000000c1'
        and lower(r.email) = 'matrix@example.com' and r.amount = 200),
    'coupon_redemptions row written');
  perform yp_tests.assert('valid percent coupon',
    (select used_count from public.coupons where code = 'MATRIX10') = 1,
    'used_count incremented');

  -- 7. Unknown / expired coupons.
  perform yp_tests.expect_reject('unknown coupon',
    yp_tests.payload('{"coupon_code": "NO-SUCH-CODE", "discount_amount": 200, "total": 2000}'),
    'coupon_invalid');
  perform yp_tests.expect_reject('expired coupon',
    yp_tests.payload('{"coupon_code": "MATRIXOLD", "discount_amount": 200, "total": 2000}'),
    'coupon_expired');

  -- 8. Per-user cap (fixed 100 off, limit 1 per user): first use passes,
  --    second use by the same email is refused.
  perform yp_tests.expect_ok('per-user coupon, first use',
    yp_tests.payload('{"coupon_code": "MATRIXONCE", "discount_amount": 100, "total": 2100, "order_number": "MTX-ONCE-1"}'));
  perform yp_tests.expect_reject('per-user coupon, second use',
    yp_tests.payload('{"coupon_code": "MATRIXONCE", "discount_amount": 100, "total": 2100, "order_number": "MTX-ONCE-2"}'),
    'coupon_limit_reached');

  -- 9. Shipping forged to 0 below the free-shipping threshold.
  perform yp_tests.expect_reject('forged free shipping',
    yp_tests.payload('{"shipping": 0, "total": 2000}'),
    'shipping mismatch');

  -- 10. Free shipping legitimately earned at/above the threshold (6 × 1000).
  o := yp_tests.expect_ok('free shipping over threshold',
    yp_tests.payload('{"items": [{"id": "00000000-0000-0000-0000-00000000000a", "qty": 6}], "subtotal": 6000, "shipping": 0, "total": 6000}'));
  perform yp_tests.assert('free shipping over threshold', o.shipping = 0, 'shipping 0 accepted at 6000 >= 5000');

  -- 11. Free-shipping coupon waives the rate below the threshold.
  perform yp_tests.expect_ok('free-shipping coupon',
    yp_tests.payload('{"coupon_code": "MATRIXSHIP", "shipping": 0, "total": 2000}'));

  -- 12. Draft product is not orderable.
  perform yp_tests.expect_reject('draft product',
    yp_tests.payload('{"items": [{"id": "00000000-0000-0000-0000-00000000000d", "qty": 1}], "subtotal": 100, "total": 300}'),
    'not available');

  -- 13. Tracked product beyond its stock (B has 3).
  perform yp_tests.expect_reject('insufficient stock',
    yp_tests.payload('{"items": [{"id": "00000000-0000-0000-0000-00000000000b", "qty": 4}], "subtotal": 2000, "total": 2200}'),
    'insufficient stock');

  -- 14. Untracked product sells at stock 0 (migration 108 semantics) and
  --     must NOT be stock-gated or ledgered.
  o := yp_tests.expect_ok('untracked product at stock 0',
    yp_tests.payload('{"items": [{"id": "00000000-0000-0000-0000-00000000000c", "qty": 2}], "subtotal": 1600, "total": 1800}'));
  perform yp_tests.assert('untracked product at stock 0',
    (select stock from public.products where id = '00000000-0000-0000-0000-00000000000c') = 0
    and not exists (select 1 from public.inventory_ledger where order_id = o.id),
    'no stock decrement, no ledger row');

  -- 14a. Vendor free shipping earned: 2 × vendored E = 2000 ≥ the vendor's
  --      1999 threshold, so shipping 0 is legitimate even though the basket
  --      is far below the 5000 zone threshold (migration 770).
  o := yp_tests.expect_ok('vendor free shipping earned',
    yp_tests.payload('{"items": [{"id": "00000000-0000-0000-0000-00000000000e", "qty": 2}], "subtotal": 2000, "shipping": 0, "total": 2000}'));
  perform yp_tests.assert('vendor free shipping applied', o.shipping = 0 and o.total = 2000,
    'expected shipping 0/total 2000, got ' || o.shipping || '/' || o.total);

  -- 14b. Vendor threshold NOT met (1 × E = 1000 < 1999): forged shipping 0
  --      still rejects.
  perform yp_tests.expect_reject('vendor threshold not met',
    yp_tests.payload('{"items": [{"id": "00000000-0000-0000-0000-00000000000e", "qty": 1}], "subtotal": 1000, "shipping": 0, "total": 1000}'),
    'shipping mismatch');

  -- 14c. Overcharge clamp (migration 780): the basket qualifies for vendor
  --      free shipping but the client (stale bundle / vendor-less cart line)
  --      quotes the paid rate anyway. The order is ACCEPTED — the client's
  --      arithmetic is coherent — but stored with shipping 0 and the total
  --      reduced to match; the customer is charged what the store promised.
  --      This is the exact shape of live order YP-ET8YOUQ76 (Rs 250 delivery
  --      billed on Rs 3,500 of NB Sons product).
  o := yp_tests.expect_ok('vendor free shipping overcharge clamped',
    yp_tests.payload('{"items": [{"id": "00000000-0000-0000-0000-00000000000e", "qty": 2}], "subtotal": 2000, "shipping": 250, "total": 2250}'));
  perform yp_tests.assert('vendor free shipping overcharge clamped',
    o.shipping = 0 and o.total = 2000,
    'expected clamp to shipping 0/total 2000, got ' || o.shipping || '/' || o.total);

  -- 14d. Overcharge clamp also covers the zone threshold: 6 × A = 6000 ≥ 5000
  --      with the client still quoting 200 → stored free.
  o := yp_tests.expect_ok('zone free shipping overcharge clamped',
    yp_tests.payload('{"items": [{"id": "00000000-0000-0000-0000-00000000000a", "qty": 6}], "subtotal": 6000, "shipping": 200, "total": 6200}'));
  perform yp_tests.assert('zone free shipping overcharge clamped',
    o.shipping = 0 and o.total = 6000,
    'expected clamp to shipping 0/total 6000, got ' || o.shipping || '/' || o.total);

  -- 14e. Referral first-order discount (migration 650, restored by 790): a
  --      fresh buyer (no prior orders under this email/phone) using someone's
  --      referral code may carry a couponless 10% discount. Migration 770/780
  --      silently dropped this branch — a referred shopper was shown the
  --      discount and then rejected with 'discount without coupon' at submit.
  begin
    o := public.place_order(
      yp_tests.payload('{"email": "matrix-referred@example.com", "phone": "03111111111", "discount_amount": 200, "total": 2000, "order_number": "MTX-REF-1"}'),
      null, null, 'MATRIXREF');
    raise notice 'ok (placed): referral discount accepted — % total %', o.order_number, o.total;
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise exception 'TEST FAIL [referral discount accepted]: expected success, got "%"', sqlerrm;
  end;
  perform yp_tests.assert('referral discount accepted',
    o.discount_amount = 200 and o.total = 2000,
    'expected discount 200/total 2000, got ' || o.discount_amount || '/' || o.total);

  -- 14f. Referral discount with a buyer who already has orders (base payload
  --      email/phone placed several above): eligibility fails server-side even
  --      though a code is supplied.
  begin
    perform public.place_order(
      yp_tests.payload('{"discount_amount": 200, "total": 2000, "order_number": "MTX-REF-2"}'),
      null, null, 'MATRIXREF');
    raise exception 'TEST FAIL [referral not first order]: order was accepted, expected referral_discount_not_eligible';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    if position('referral_discount_not_eligible' in sqlerrm) = 0 then
      raise exception 'TEST FAIL [referral not first order]: expected referral_discount_not_eligible, got "%"', sqlerrm;
    end if;
    raise notice 'ok (rejected): referral not first order — %', sqlerrm;
  end;

  -- 14g. Loyalty redemption records a payment (migration 800): a signed-in
  --      buyer redeems 200 points (rate defaults to 1 PKR/point) — the order
  --      is placed at its full total, the points are deducted, AND a
  --      succeeded 'loyalty_points' payment of 200 is recorded so the COD
  --      collectible is total − 200. Before 800 the points vanished with no
  --      payment trace and the courier collected the full total.
  o := public.place_order(
    yp_tests.payload('{"email": "matrix-loyal@example.com", "phone": "03122222222", "user_id": "00000000-0000-0000-0000-0000000000f2", "order_number": "MTX-PTS-1"}'),
    null, 200, null);
  perform yp_tests.assert('loyalty redemption payment recorded',
    exists (select 1 from public.payments p
            where p.order_id = o.id and p.gateway = 'loyalty_points'
              and p.status = 'succeeded' and p.amount = 200),
    'payments row gateway=loyalty_points amount=200');
  -- Ledger delta, not an absolute balance: the welcome-points trigger on
  -- auth.users also credits this seeded account, so the balance isn't fixed.
  perform yp_tests.assert('loyalty balance debited',
    exists (select 1 from public.loyalty_ledger l
            where l.user_id = '00000000-0000-0000-0000-0000000000f2'
              and l.order_id = o.id and l.delta = -200 and l.reason = 'redemption'),
    'loyalty_ledger redemption row delta=-200 for the order');

  -- 15. Client subtotal that disagrees with server-recomputed prices.
  perform yp_tests.expect_reject('subtotal mismatch',
    yp_tests.payload('{"subtotal": 1500, "total": 1700}'),
    'subtotal mismatch');

  -- 16. Total that disagrees with subtotal + shipping - discount.
  perform yp_tests.expect_reject('total mismatch',
    yp_tests.payload('{"total": 9999}'),
    'total mismatch');

  -- 17. Junk payloads.
  perform yp_tests.expect_reject('empty cart',   yp_tests.payload('{"items": []}'), 'cart is empty');
  perform yp_tests.expect_reject('bad pay method',
    yp_tests.payload('{"pay_method": "iou"}'), 'invalid pay_method');
  perform yp_tests.expect_reject('unknown product',
    yp_tests.payload('{"items": [{"id": "00000000-0000-0000-0000-0000000000ff", "qty": 1}], "subtotal": 0, "total": 200}'),
    'not found');
  perform yp_tests.expect_reject('zero quantity',
    yp_tests.payload('{"items": [{"id": "00000000-0000-0000-0000-00000000000a", "qty": 0}], "subtotal": 0, "total": 200}'),
    'invalid quantity');

  raise notice 'place_order matrix: all cases passed';
end $$;

-- Throwaway database: roll everything back anyway so the suite can be
-- re-run against the same build during local debugging.
rollback;
