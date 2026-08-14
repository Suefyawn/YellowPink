-- Migration 1120 — automatic discounts (Shopify's no-code discounts).
--
-- An automatic discount is a coupons row with trigger_kind='automatic': the
-- cart fetches active automatics, validates them with the SAME client rules
-- as typed codes, applies the best one by itself, and the order goes through
-- place_order carrying the row's (hidden, generated) code — so the entire
-- hardened path (scoped discount base, drift check, redemption ledger,
-- per-user caps, start/end windows) works unchanged. The shopper sees the
-- customer-facing `title` ("Azadi Sale: 14% off"), never the code.
--
-- Precedence lives client-side and is deliberately simple, matching the
-- store's one-discount rule: a manually entered code always wins; otherwise
-- the best (largest-discount) eligible automatic applies.

alter table public.coupons
  add column if not exists trigger_kind text not null default 'code'
    check (trigger_kind in ('code', 'automatic')),
  add column if not exists title text;

comment on column public.coupons.trigger_kind is
  'code = shopper types it. automatic = the cart applies it by itself; the code is generated and hidden, title is what the shopper sees.';
comment on column public.coupons.title is
  'Customer-facing label for automatic discounts, shown on the cart/checkout discount line.';

-- The storefront needs the active automatics without a code to look up.
-- Mirrors lookup_coupon's posture: SECURITY DEFINER instead of a blanket
-- anon read on the coupons table; returns only rows the cart may apply.
create or replace function public.active_automatic_discounts()
returns setof public.coupons
language sql
stable
security definer
set search_path = public
as $$
  select * from public.coupons
  where trigger_kind = 'automatic'
    and active = true
    and (starts_at  is null or starts_at  <= now())
    and (expires_at is null or expires_at >  now())
    and (max_uses is null or used_count < max_uses)
  order by created_at
$$;

grant execute on function public.active_automatic_discounts() to anon, authenticated;

-- lookup_coupon must not resolve an automatic's internal code typed by hand
-- (they're unlisted, not secret, but typing one shouldn't beat precedence).
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
    and trigger_kind = 'code'
    and (starts_at is null or starts_at <= now())
  limit 1;
$$;

grant execute on function public.lookup_coupon(text) to anon, authenticated;
