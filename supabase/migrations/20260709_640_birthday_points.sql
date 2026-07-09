-- Birthday rewards, the missing half of Phase 4.6. The rewards page has
-- advertised "+200 pts on your birthday (set DOB on your profile)" since the
-- loyalty launch, but nothing collected a DOB and nothing awarded the points.
-- The profile page now collects profiles.dob; this function awards the points
-- and the daily cron (/api/cron/birthday-rewards) calls it once a day.
--
-- Rules:
--   • Points value comes from site_settings.loyalty_birthday_points (the same
--     admin-editable source the other earn rules use); default 200, 0 = off.
--   • "Birthday" is matched on month+day in Pakistan time. A Feb-29 birthday
--     is celebrated on Feb 28 in non-leap years, so it never goes unawarded.
--   • At most one award per ~11 months (300-day lookback on the ledger), so
--     re-runs on the same day, timezone edges, and year boundaries can't
--     double-award.
create or replace function public.award_birthday_points()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_points integer;
  v_today  date := (now() at time zone 'Asia/Karachi')::date;
  v_count  integer := 0;
  r record;
begin
  select coalesce(nullif(trim(value), '')::integer, 200) into v_points
    from public.site_settings where key = 'loyalty_birthday_points';
  if v_points is null then v_points := 200; end if;
  if v_points <= 0 then return 0; end if;

  for r in
    select p.id
    from public.profiles p
    where p.dob is not null
      and (
        to_char(p.dob, 'MM-DD') = to_char(v_today, 'MM-DD')
        -- Feb-29 birthdays celebrate on Feb 28 when the year has no Feb 29.
        or (to_char(p.dob, 'MM-DD') = '02-29'
            and to_char(v_today, 'MM-DD') = '02-28'
            and not (extract(year from v_today)::int % 4 = 0
                     and (extract(year from v_today)::int % 100 <> 0
                          or extract(year from v_today)::int % 400 = 0)))
      )
      and not exists (
        select 1 from public.loyalty_ledger l
        where l.user_id = p.id
          and l.reason = 'birthday'
          and l.created_at > now() - interval '300 days'
      )
  loop
    perform public.grant_loyalty_points(r.id, v_points, 'birthday', null, 'Happy birthday from Yellow Pink!');
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

-- Cron-only entry point: callable by the service role, never by browsers.
revoke all on function public.award_birthday_points() from public;
revoke all on function public.award_birthday_points() from anon;
revoke all on function public.award_birthday_points() from authenticated;
grant execute on function public.award_birthday_points() to service_role;
