-- ============================================================================
-- Order next-step nudges. 2026-07-31.
--
-- The order workflow's follow-ups (confirm the customer, dispatch, chase
-- delivery, record the courier charge, record COGS, reconcile the COD
-- payout, settle the vendor) lived in staff memory and steps were missed.
-- The daily cron (api/cron/order-actions) now evaluates every active order
-- against lib/order-actions.ts and posts one deduped notification per
-- outstanding step; this migration adds the 'order_action' kind it uses.
--
-- Also: the new-order notification now SAYS the next step (confirm on
-- WhatsApp, then mark Preparing) instead of just announcing the order —
-- the whole point of the nudge system is that nobody has to remember the
-- sequence.
-- ============================================================================

alter table public.admin_notifications drop constraint if exists admin_notifications_kind_check;
alter table public.admin_notifications add constraint admin_notifications_kind_check
  check (kind in (
    'new_order','low_stock','payment_failed','return_request','new_review','staff_added',
    'sentry_issue','posthog_spike','posthog_drop','new_message',
    'abandoned_cart','integration','order_action'
  ));

create or replace function public.notify_new_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_notifications (kind, title, body, link, entity_id)
  values (
    'new_order',
    'New order ' || new.order_number,
    new.first_name || ' ' || new.last_name || ' · PKR ' || new.total::text
      || ' — next: confirm with the customer (WhatsApp/call), then mark it Preparing.',
    '/admin/orders/' || new.id::text,
    new.id::text
  );
  return new;
end $$;
drop trigger if exists orders_notify_new on public.orders;
create trigger orders_notify_new
  after insert on public.orders
  for each row execute function public.notify_new_order();
