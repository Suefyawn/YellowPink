-- ============================================================================
-- Medical Review Board — self-serve doctor portal (v1).
--
-- Doctors apply through a public form; the owner vets and approves; an approved
-- doctor gets a magic-link login and a dashboard to edit their own profile and
-- see the articles credited to them. (Loyalty-point rewards come later.)
--
-- This migration:
--   1. Links a content_reviewers row to a Supabase auth user + email, so an
--      approved doctor can sign in and self-edit.
--   2. Adds the reviewer_applications vetting inbox (locked down — read/approve
--      happen via the service-role admin client; there is no public access).
-- ============================================================================

-- 1. Doctor account link on the public profile row ---------------------------
alter table public.content_reviewers
  add column if not exists email        text unique,
  add column if not exists auth_user_id uuid unique;

-- A signed-in reviewer may read their OWN row even before it's public, and
-- update it (the server action whitelists editable columns — bio, photo,
-- specialty, profile_url, topics — and never active/is_default/auth_user_id).
drop policy if exists content_reviewers_self_read on public.content_reviewers;
create policy content_reviewers_self_read on public.content_reviewers
  for select using ( auth.uid() = auth_user_id );

drop policy if exists content_reviewers_self_update on public.content_reviewers;
create policy content_reviewers_self_update on public.content_reviewers
  for update using ( auth.uid() = auth_user_id ) with check ( auth.uid() = auth_user_id );

-- 2. Vetting inbox -----------------------------------------------------------
create table if not exists public.reviewer_applications (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null,
  credentials   text,
  pmdc_number   text,                 -- Pakistan Medical & Dental Council reg #
  specialty     text,
  bio           text,
  profile_url   text,                 -- hospital / PMDC / LinkedIn (verifiable)
  review_topics text[] not null default '{}',
  message       text,
  status        text not null default 'pending'
                  check (status in ('pending','approved','rejected')),
  notes         text,                 -- owner's private note (e.g. why rejected)
  reviewer_id   uuid references public.content_reviewers(id) on delete set null,
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz
);

create index if not exists reviewer_applications_status_idx
  on public.reviewer_applications (status, created_at desc);

-- Locked down: no policies → no anon/authenticated access. Submissions are
-- inserted by the apply server action and read/approved by the owner, both
-- through the service-role admin client (which bypasses RLS).
alter table public.reviewer_applications enable row level security;
