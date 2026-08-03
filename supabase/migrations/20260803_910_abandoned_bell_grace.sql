-- ============================================================================
-- Abandoned-checkout bell: 20-minute grace period instead of instant fire.
--
-- The 800 migration belled the moment a checkout was captured. But capture
-- happens when the shopper completes the CONTACT step, so anyone who went on
-- to pay produced a false "Abandoned checkout" push seconds before their
-- "New order" push (owner report, 3 Aug: Falisha 19s apart, Abdul 34s apart).
--
-- New model: no bell on insert. A pg_cron job runs every 10 minutes and
-- bells only carts that are ≥20 minutes old, still un-recovered, and not
-- yet belled. Converted checkouts (recovered=true within the grace window)
-- never make a sound. The daily staff-email digest (admin_alerted_at) is
-- unchanged and still covers the long tail.
--
-- pg_cron exists on Supabase but not in the CI chain's vanilla postgres, so
-- every pg_cron touch is guarded; CI applies the trigger/function changes
-- and skips the scheduling.
-- ============================================================================

-- 1. The instant trigger goes away.
drop trigger if exists abandoned_carts_notify_new on public.abandoned_carts;
drop function if exists public.notify_abandoned_cart();

-- 2. Bell dedupe stamp (separate from admin_alerted_at, which the daily
--    staff-email digest owns).
alter table public.abandoned_carts add column if not exists bell_alerted_at timestamptz;
comment on column public.abandoned_carts.bell_alerted_at is
  'When the admin bell/push for this cart fired (20-min-grace cron dedupe). NULL = not yet.';

-- 3. The grace-period sweep. SECURITY DEFINER: runs as the migration owner
--    from cron with no session user.
create or replace function public.process_abandoned_cart_bells()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_count integer := 0;
  v_cart  record;
begin
  for v_cart in
    select id, first_name, phone, email, subtotal
    from public.abandoned_carts
    where recovered = false
      and bell_alerted_at is null
      and created_at < now() - interval '20 minutes'
      and last_activity_at < now() - interval '20 minutes'
  loop
    insert into public.admin_notifications (kind, title, body, link, entity_id)
    values (
      'abandoned_cart',
      'Abandoned checkout · PKR ' || coalesce(round(v_cart.subtotal)::text, '?'),
      coalesce(nullif(trim(v_cart.first_name), ''), 'A shopper')
        || case when v_cart.phone is not null then ' · ' || v_cart.phone else '' end
        || case when v_cart.email is not null then ' · ' || v_cart.email else '' end,
      '/admin/abandoned',
      v_cart.id::text
    );
    update public.abandoned_carts set bell_alerted_at = now() where id = v_cart.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- 4. Schedule every 10 minutes where pg_cron exists (production).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    -- unschedule a previous copy if re-applied
    perform cron.unschedule(jobid) from cron.job where jobname = 'abandoned-cart-bells';
    perform cron.schedule('abandoned-cart-bells', '*/10 * * * *',
      'select public.process_abandoned_cart_bells()');
  end if;
end $$;
