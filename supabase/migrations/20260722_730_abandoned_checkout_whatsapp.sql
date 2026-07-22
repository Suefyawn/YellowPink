-- ============================================================================
-- Abandoned-checkout WhatsApp follow-up.
--
-- The COD checkout asks for phone FIRST; most shoppers who bail never reach
-- the email field, so the email-keyed abandoned_carts capture missed the bulk
-- of begun-but-unplaced checkouts. This migration:
--   • lets a row exist on phone alone (email becomes nullable; phone-only
--     rows are deduped by a partial unique index),
--   • captures phone + first name alongside email when both exist,
--   • marks recovery on order placement by phone as well as email,
--   • records the manual WhatsApp nudge (who/when) on the row itself so the
--     admin queue (admin → Customers → Abandoned) never double-messages.
-- Email reminder cron is unchanged; it now simply skips phone-only rows.
-- ============================================================================

alter table public.abandoned_carts alter column email drop not null;
alter table public.abandoned_carts add column if not exists phone text;
alter table public.abandoned_carts add column if not exists first_name text;
alter table public.abandoned_carts add column if not exists last_wa_sent_at timestamptz;
alter table public.abandoned_carts add column if not exists wa_sent_by text;

-- One row per phone among rows that have no email (email rows keep the
-- existing unique(email) as their identity).
create unique index if not exists abandoned_carts_phone_only_unique
  on public.abandoned_carts (phone) where email is null;

-- A row must have at least one way to reach the shopper.
alter table public.abandoned_carts drop constraint if exists abandoned_carts_contact_check;
alter table public.abandoned_carts add constraint abandoned_carts_contact_check
  check (email is not null or phone is not null);

-- ─── capture RPC v2: email OR phone keys the row ────────────────────────────
-- Same name/first-4-args as v1 so the existing client call keeps working;
-- p_phone/p_name default null. Phone is normalised to digits (0… → 92…) so
-- the recovered-trigger and the admin wa.me links agree on the format.
drop function if exists public.capture_abandoned_cart(text, jsonb, numeric, uuid);
create or replace function public.capture_abandoned_cart(
  p_email     text,
  p_cart      jsonb,
  p_subtotal  numeric,
  p_user_id   uuid default null,
  p_phone     text default null,
  p_name      text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name  text := nullif(left(trim(coalesce(p_name, '')), 80), '');
begin
  if v_phone <> '' and left(v_phone, 1) = '0' then
    v_phone := '92' || substr(v_phone, 2);
  end if;
  if length(v_phone) < 11 then
    v_phone := null;  -- too short to be a reachable PK number
  end if;
  if v_email is null and v_phone is null then
    raise exception 'email or phone is required';
  end if;
  if jsonb_typeof(p_cart) <> 'array' or jsonb_array_length(p_cart) = 0 then
    raise exception 'cart must be a non-empty array';
  end if;

  if v_email is not null then
    -- Email row is the canonical identity; fold in phone/name when present
    -- and absorb any earlier phone-only row for the same shopper so the
    -- admin queue never shows them twice.
    if v_phone is not null then
      delete from public.abandoned_carts where email is null and phone = v_phone;
    end if;
    insert into public.abandoned_carts (email, phone, first_name, user_id, cart_items, subtotal)
    values (v_email, v_phone, v_name, p_user_id, p_cart, p_subtotal)
    on conflict (email) do update
      set cart_items       = excluded.cart_items,
          subtotal         = excluded.subtotal,
          phone            = coalesce(excluded.phone, public.abandoned_carts.phone),
          first_name       = coalesce(excluded.first_name, public.abandoned_carts.first_name),
          user_id          = coalesce(excluded.user_id, public.abandoned_carts.user_id),
          last_activity_at = now(),
          -- Reset the reminder cadence when the cart changes — we want to
          -- start the 1h timer over.
          reminder_tier    = 0,
          last_emailed_at  = null,
          recovered        = false
      returning restore_token into v_token;
    if v_token is null then
      select restore_token into v_token from public.abandoned_carts where email = v_email;
    end if;
  else
    insert into public.abandoned_carts (email, phone, first_name, user_id, cart_items, subtotal)
    values (null, v_phone, v_name, p_user_id, p_cart, p_subtotal)
    on conflict (phone) where email is null do update
      set cart_items       = excluded.cart_items,
          subtotal         = excluded.subtotal,
          first_name       = coalesce(excluded.first_name, public.abandoned_carts.first_name),
          user_id          = coalesce(excluded.user_id, public.abandoned_carts.user_id),
          last_activity_at = now(),
          reminder_tier    = 0,
          last_emailed_at  = null,
          recovered        = false
      returning restore_token into v_token;
    if v_token is null then
      select restore_token into v_token from public.abandoned_carts
        where email is null and phone = v_phone;
    end if;
  end if;

  return v_token;
end $$;

grant execute on function public.capture_abandoned_cart(text, jsonb, numeric, uuid, text, text) to anon, authenticated;

-- ─── recovered-trigger v2: match on email OR phone ──────────────────────────
create or replace function public.mark_abandoned_cart_recovered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
begin
  if v_phone <> '' and left(v_phone, 1) = '0' then
    v_phone := '92' || substr(v_phone, 2);
  end if;
  if new.email is not null and length(new.email) > 0 then
    update public.abandoned_carts
      set recovered = true
      where email = lower(trim(new.email))
        and not recovered;
  end if;
  if length(v_phone) >= 11 then
    update public.abandoned_carts
      set recovered = true
      where phone = v_phone
        and not recovered;
  end if;
  return new;
end $$;
