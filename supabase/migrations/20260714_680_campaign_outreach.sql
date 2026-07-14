-- ============================================================================
-- Campaign outreach log (WhatsApp win-back).
--
-- The win-back surface (admin → Win-back) lists lapsed past buyers with a
-- personalised wa.me send link; this table records who has already been
-- messaged per campaign so nobody gets the same outreach twice — across
-- sessions, devices and staff members. Staff-only data: no public policies,
-- every read/write goes through the service role on the admin server.
-- ============================================================================

create table if not exists public.campaign_outreach (
  id          uuid primary key default gen_random_uuid(),
  campaign    text not null,
  -- Same customer identity key the Segments view uses:
  -- user_id > lower(email) > digits-only phone.
  cust_key    text not null,
  sent_at     timestamptz not null default now(),
  sent_by     text,
  unique (campaign, cust_key)
);

alter table public.campaign_outreach enable row level security;
-- Deliberately NO anon/authenticated policies: service-role only.
