-- Migration 1070 — suggested cash entries.
--
-- The cashbook (migration 1040) is hand-recorded, but two kinds of movement
-- are already recorded elsewhere in the admin: vendor settlements (Vendors →
-- Settle) and reconciled online payments (bank/wallet rows on orders). The
-- Cash page now proposes those as one-tap entries. Confirmed suggestions
-- carry their source key so nothing is proposed twice; skipped ones land in
-- a skip list. The books stay separate — a suggestion only becomes cash when
-- a human confirms it.

alter table public.cash_entries
  add column if not exists source_key text;

-- One cash entry per source record; NULLs (hand-typed entries) don't collide.
create unique index if not exists cash_entries_source_key_unique
  on public.cash_entries (source_key)
  where source_key is not null;

comment on column public.cash_entries.source_key is
  'Set when the entry was confirmed from a suggestion (settle:… / payment:…); used to never suggest the same source twice.';

create table if not exists public.cash_suggestion_skips (
  source_key text primary key,
  created_at timestamptz not null default now()
);

-- Admin-only, like cash_entries: RLS on with no policies → service role only.
alter table public.cash_suggestion_skips enable row level security;
