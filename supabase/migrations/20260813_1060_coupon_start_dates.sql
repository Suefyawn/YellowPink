-- Migration 1060 — coupon start dates (Shopify "active dates": start + end).
--
-- A sale that begins Friday used to mean creating the coupon Friday morning
-- or leaving it live early. Coupons now carry starts_at alongside expires_at:
-- before the start the code is invisible to the storefront (lookup_coupon
-- filters it), refused by place_order, and shown as "Scheduled" in the admin.

alter table public.coupons
  add column if not exists starts_at timestamptz;

comment on column public.coupons.starts_at is
  'Coupon is unusable before this moment (Scheduled in the admin). NULL = active immediately.';

-- Storefront lookup: a not-yet-started code behaves exactly like an unknown
-- one, matching Shopify's scheduled discounts.
create or replace function public.lookup_coupon(p_code text)
returns setof public.coupons
language sql
stable
security definer
set search_path = public
as $$
  select * from public.coupons
  where upper(code) = upper(trim(p_code))
    and active = true
    and (starts_at is null or starts_at <= now())
  limit 1;
$$;

grant execute on function public.lookup_coupon(text) to anon, authenticated;

-- place_order gate, patched in place (migration-1020 technique; comment-free
-- match so it holds against both the repo chain and the production copy).
DO $mig$
DECLARE
  def text;
  before text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO def
    FROM pg_proc WHERE proname = 'place_order' AND pronamespace = 'public'::regnamespace;

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
