-- ============================================================================
-- Product-finder quiz — first-party event log.
--
-- The interactive quiz at /quiz recommends products (skincare or wellness) and
-- captures opt-in emails. We send rich events to PostHog for funnels, but ALSO
-- log a first-party row per milestone here so the admin dashboard can show a
-- reliable start → complete → email funnel without depending on the PostHog API.
--
-- Locked down: no policies → all writes go through the quiz server actions on
-- the service-role client, and the dashboard reads the same way.
-- ============================================================================

create table if not exists public.quiz_events (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null,                       -- one quiz attempt (client-generated)
  type            text not null check (type in ('started','completed','email_captured')),
  branch          text check (branch in ('skincare','wellness')),
  answers         jsonb,
  recommended_ids uuid[] not null default '{}',
  created_at      timestamptz not null default now()
);

create index if not exists quiz_events_type_idx    on public.quiz_events (type, created_at desc);
create index if not exists quiz_events_session_idx on public.quiz_events (session_id);

alter table public.quiz_events enable row level security;
