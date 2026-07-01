-- Tracks whether Google has picked up individual new pages for indexing.
-- Google's Indexing API only covers JobPosting/BroadcastEvent content, so
-- there is no legitimate way to *force*-submit an arbitrary blog/product page
-- programmatically (the read-only urlInspection API is the only per-URL
-- endpoint available for this kind of site, see inspectUrl() in src/lib/google.ts).
-- This table instead tracks *status* for newly-published pages so staff can
-- see, at a glance, which few still need a manual "Request Indexing" click in
-- Search Console, rather than guessing across dozens of new URLs.

create table if not exists public.gsc_url_index_status (
  path              text primary key,
  coverage_state    text,
  verdict           text,
  google_canonical  text,
  last_crawl_time   timestamptz,
  first_seen_at     timestamptz not null default now(),
  last_checked_at   timestamptz,
  checks            integer not null default 0,
  is_indexed        boolean generated always as (
    verdict = 'PASS' and coverage_state ilike '%indexed%'
  ) stored
);

comment on table public.gsc_url_index_status is
  'Per-URL Search Console indexing status for newly-published pages, refreshed by the '
  'indexing-check cron (checkIndexingStatus in src/lib/indexing-status.ts) via the read-only '
  'urlInspection API. Lets staff see which new pages Google has not indexed yet without '
  'checking each one by hand in GSC. Service-role only (no anon policies).';

alter table public.gsc_url_index_status enable row level security;
