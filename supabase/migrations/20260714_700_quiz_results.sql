-- ============================================================================
-- Saved Routine Finder results.
--
-- Completing the quiz now produces a durable, shareable routine at
-- /quiz/r/<code> instead of a screen that vanishes on refresh. The row stores
-- the answers plus the computed picks (product ids + the "why" line per pick)
-- so the share page can re-render the routine with live product data.
--
-- Service-role only: the server action writes on completion and the share
-- page reads through supabaseAdmin(). The code is unguessable (48 bits), so
-- a result is private to whoever holds the link.
-- ============================================================================

create table if not exists public.quiz_results (
  code       text primary key,
  branch     text not null,
  answers    jsonb not null,
  -- [{ key, label, note, picks: [{ id, why }] }]
  sections   jsonb not null,
  guides     jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.quiz_results enable row level security;
-- Deliberately NO anon/authenticated policies: service-role only.
