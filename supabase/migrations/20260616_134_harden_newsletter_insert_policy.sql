-- Audit fix (security): the anon INSERT policy on newsletter_subscribers used
-- WITH CHECK (true), letting anyone POST arbitrary rows to the table. Keep the
-- public footer/checkout sign-up working, but require a minimally valid email so
-- the endpoint can't be used to write junk rows.
drop policy if exists newsletter_anon_insert on public.newsletter_subscribers;
create policy newsletter_anon_insert on public.newsletter_subscribers
  for insert to anon, authenticated
  with check (
    email is not null
    and char_length(email) between 3 and 320
    and position('@' in email) > 1
    and position('.' in split_part(email, '@', 2)) > 0
  );
