-- Migration 302 — allow free-shipping coupons to carry a zero value.
--
-- Audit 2026-07-02: the coupons schema has supported free-shipping coupons
-- since migration 014 (`discount_type = 'free_shipping'`, `free_shipping`
-- boolean) and the hardened place_order (migration 301) validates them with
-- `value = 0` ("free-shipping-only coupons may carry no line discount").
-- But the baseline check constraint `value > 0` made such a row impossible
-- to insert, which is one reason the admin UI never offered the type.
--
-- Relax the check: a zero value is valid if — and only if — the coupon is a
-- free-shipping coupon. Percent/fixed coupons still require value > 0.

alter table public.coupons
  drop constraint if exists coupons_value_check;

alter table public.coupons
  add constraint coupons_value_check
  check (value > 0 or (coalesce(free_shipping, false) and value = 0));
