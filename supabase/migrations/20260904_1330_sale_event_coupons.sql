-- Sales & occasions: the coupon is part of the saved look. 2026-09-04.
--
-- Owner report: every occasion's announcement bar advertises a code
-- (DEFENCE, AZADI, ELEVEN…) but activating the occasion never created it —
-- "Coupons are suggestions" (migration 1250). Shoppers saw a code that
-- checkout rejected as invalid unless someone remembered to make it in
-- Coupons first. Shopify's model is that a sale carries its discount, so the
-- occasion now stores the discount settings and activation (manual,
-- scheduled, or the autopilot calendar) creates or updates the coupon row,
-- bounded to the occasion's window.
alter table public.sale_events
  add column if not exists coupon_type text not null default 'percent'
    check (coupon_type in ('percent', 'fixed', 'free_shipping')),
  add column if not exists coupon_value numeric not null default 10
    check (coupon_value >= 0),
  add column if not exists coupon_min_order numeric not null default 0
    check (coupon_min_order >= 0),
  add column if not exists coupon_max_uses integer
    check (coupon_max_uses is null or coupon_max_uses > 0),
  add column if not exists coupon_per_user integer
    check (coupon_per_user is null or coupon_per_user > 0),
  add column if not exists coupon_exclude_sale_items boolean not null default false;

comment on column public.sale_events.coupon_type is
  'Discount the bar_coupon code gives: percent / fixed (PKR) / free_shipping. Written to public.coupons when the occasion is activated.';
comment on column public.sale_events.coupon_value is
  'Percent (0-100) or fixed PKR amount for bar_coupon. Ignored for free_shipping.';
comment on column public.sale_events.coupon_min_order is
  'Minimum order subtotal (PKR) for the coupon, 0 = none.';
comment on column public.sale_events.coupon_max_uses is
  'Total redemptions allowed, NULL = unlimited.';
comment on column public.sale_events.coupon_per_user is
  'Redemptions per customer (email/account), NULL = unlimited.';

-- Seed the value from the bar message where it already states one
-- ("up to 15% off" → 15); everything else keeps the 10% default and is
-- editable on the occasion card.
update public.sale_events
   set coupon_value = (regexp_match(bar_message, '(\d{1,2})% off'))[1]::numeric
 where bar_message ~ '\d{1,2}% off';
