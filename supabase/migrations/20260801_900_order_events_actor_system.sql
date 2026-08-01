-- Migration 900 — order_events default actor is 'system', not 'staff'.
--
-- The status-change trigger stamped every UPDATE transition as actor_kind
-- 'staff', so courier-scan cascades, gateway callbacks and cron transitions
-- all read as if a human did them (2026-08-01 audit). The manual admin paths
-- re-attribute their events to the signed-in operator right after the write
-- (attributeOrderEvents), so defaulting to 'system' makes the un-attributed
-- remainder honest: anything still 'system' genuinely was automated.

create or replace function public.log_order_status_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.order_events (order_id, from_status, to_status, actor_kind, actor_id)
    values (new.id, null, new.status, 'system', null);
    return new;
  end if;

  if (tg_op = 'UPDATE' and (new.status is distinct from old.status)) then
    insert into public.order_events (order_id, from_status, to_status, actor_kind, actor_id, metadata)
    values (
      new.id,
      old.status,
      new.status,
      'system',
      null,
      jsonb_build_object(
        'tracking_number', new.tracking_number,
        'courier', new.courier
      )
    );
  end if;
  return new;
end $$;
