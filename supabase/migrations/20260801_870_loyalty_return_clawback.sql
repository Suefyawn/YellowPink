-- Migration 870 — loyalty points go back when the order does.
--
-- Points are awarded when an order is delivered (migration 030's
-- orders_award_points trigger). Until now nothing reversed them when the
-- delivered order later bounced (courier return recorded late, or an RMA
-- refund), so customers kept points for purchases that earned the store
-- nothing (2026-08-01 audit; owner decision: claw back).
--
-- Implemented as a DB trigger, the same layer as the award, so it fires on
-- EVERY path that moves an order to returned/refunded — manual button,
-- courier scan cascade, RMA flow — with no app-side wiring to forget.
--
-- Semantics:
--   • Reverses only what this order actually awarded ('order_delivered'
--     rows for this order), minus what any earlier clawback already took —
--     idempotent across repeated transitions (returned → refunded takes
--     nothing twice).
--   • Ledger reason 'return_clawback' (new), distinct from
--     'refund_reversal' which the RMA flow uses for POSITIVE store-credit
--     grants.
--   • grant_loyalty_points floors the balance at zero by design: a customer
--     who already spent the points doesn't go negative, they simply start
--     their next earn from zero. lifetime_points is untouched (it only ever
--     grows, by design).

alter table public.loyalty_ledger
  drop constraint if exists loyalty_ledger_reason_check;
alter table public.loyalty_ledger
  add constraint loyalty_ledger_reason_check check (reason in (
    'welcome', 'order_delivered', 'review_approved', 'referral_reward',
    'redemption', 'birthday', 'manual', 'refund_reversal', 'return_clawback'
  ));

create or replace function public.clawback_points_on_return()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_awarded integer;
  v_clawed  integer;
  v_take    integer;
begin
  if new.status in ('returned', 'refunded')
     and old.status is distinct from new.status
     and old.status not in ('returned', 'refunded')  -- entering the bounced pair, not moving within it
     and new.user_id is not null then
    select coalesce(sum(delta), 0)  into v_awarded
      from public.loyalty_ledger where order_id = new.id and reason = 'order_delivered';
    select coalesce(sum(-delta), 0) into v_clawed
      from public.loyalty_ledger where order_id = new.id and reason = 'return_clawback';
    v_take := v_awarded - v_clawed;
    if v_take > 0 then
      perform public.grant_loyalty_points(
        new.user_id, -v_take, 'return_clawback', new.id,
        'Points reversed: order ' || coalesce(new.order_number, new.id::text) || ' marked ' || new.status
      );
    end if;
  end if;
  return new;
end $$;

drop trigger if exists orders_clawback_points on public.orders;
create trigger orders_clawback_points
  after update of status on public.orders
  for each row execute function public.clawback_points_on_return();
