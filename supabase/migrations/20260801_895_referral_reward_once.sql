-- Migration 895 — a referral pays out exactly once per referee.
--
-- award_referral_for_user is called when the referee's FIRST delivered order
-- lands (migration 030's award trigger). After a delivered → returned →
-- delivered cycle, the "count of delivered orders = 1" check can be true a
-- second time and the referrer got paid again (2026-08-01 audit). The ledger
-- note format is stable ('Reward for referring <uuid>'), so an exists-check
-- makes the payout idempotent without any schema change.

create or replace function public.award_referral_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code        text;
  v_referrer_id uuid;
  v_reward      integer;
begin
  select referred_by_code into v_code from public.profiles where id = p_user_id;
  if v_code is null then return; end if;

  select id into v_referrer_id from public.profiles where referral_code = v_code;
  if v_referrer_id is null or v_referrer_id = p_user_id then return; end if;

  -- Already rewarded for this referee (any earlier delivery) → no-op.
  if exists (
    select 1 from public.loyalty_ledger
    where user_id = v_referrer_id
      and reason  = 'referral_reward'
      and note    = 'Reward for referring ' || p_user_id::text
  ) then
    return;
  end if;

  select coalesce(value::integer, 0) into v_reward
    from public.site_settings where key = 'loyalty_referral_points';
  if v_reward > 0 then
    perform public.grant_loyalty_points(v_referrer_id, v_reward, 'referral_reward', null,
      'Reward for referring ' || p_user_id::text);
  end if;
end $$;
