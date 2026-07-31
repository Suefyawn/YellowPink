-- ============================================================================
-- SEO ranking snapshots. 2026-07-31.
--
-- Twice a month (1st & 15th) a scheduled Claude session checks yellowpink.pk's
-- Google positions in the Semrush Pakistan index and appends one row per
-- tracked keyword here. Admin → SEO rankings renders the latest batch with
-- movement against the previous one, so ranking progress lives in the
-- dashboard instead of a chat thread. Batches are grouped by checked_at
-- (all rows in one check share the same timestamp).
-- ============================================================================

create table if not exists public.seo_ranking_snapshots (
  id          uuid primary key default gen_random_uuid(),
  checked_at  timestamptz not null default now(),
  source      text not null default 'semrush_pk',
  keyword     text not null,
  position    numeric(6,1),          -- null = not in top 100 this check
  volume      integer,               -- monthly searches (Semrush, pk db)
  url         text,                  -- ranking page
  created_at  timestamptz not null default now()
);

create index if not exists seo_ranking_snapshots_batch_idx
  on public.seo_ranking_snapshots (checked_at desc, keyword);

alter table public.seo_ranking_snapshots enable row level security;
-- No public policies: written by the scheduled checker (service role),
-- read by admin pages (service role).
