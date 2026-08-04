-- ============================================================================
-- Tracked-keyword list for the admin SEO rankings page.
--
-- Until now the keyword set lived only inside the twice-monthly ranking
-- routine's prompt: staff could see results but never change what gets
-- checked. This table makes the list data. The admin page (and its server
-- actions) manage rows; the scheduled ranking check MUST read its keyword
-- list from here (select keyword from seo_tracked_keywords where active)
-- instead of a hardcoded list, so a keyword added in the admin is picked up
-- on the next 1st/15th run automatically.
--
-- Deactivating (active=false) rather than deleting keeps snapshot history
-- joinable if the keyword is ever re-tracked.
-- ============================================================================

create table if not exists public.seo_tracked_keywords (
  keyword    text primary key,
  -- Monthly PK search volume, denormalised from the latest Semrush check.
  -- The routine refreshes it each run; NULL until the first check runs.
  volume     integer,
  -- The page we WANT to rank for this keyword (optional). The routine
  -- records the URL Google actually serves in seo_ranking_snapshots.url,
  -- and the admin page flags mismatches (cannibalisation signal).
  target_url text,
  active     boolean not null default true,
  added_by   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.seo_tracked_keywords is
  'Keywords the twice-monthly SEO ranking routine checks. Managed from /admin/seo-rankings; service-role access only.';

-- Service-role only (admin pages use supabaseAdmin): RLS on, no policies.
alter table public.seo_tracked_keywords enable row level security;

-- Seed from the keywords already being checked, carrying volume and the
-- currently-ranking URL from each keyword's most recent snapshot row.
insert into public.seo_tracked_keywords (keyword, volume, target_url, added_by)
select distinct on (keyword) keyword, volume, url, 'seed:snapshots'
from public.seo_ranking_snapshots
order by keyword, checked_at desc
on conflict (keyword) do nothing;
