-- ============================================================================
-- 404 monitor — not_found_log + atomic logger, plus two true-equivalent
-- legacy redirects surfaced by the GSC "Not found (404)" drilldown.
--
-- The storefront 404 boundary (app/not-found.tsx) records every miss here via
-- after(), aggregated per-path so 1,000 Googlebot hits on one dead URL collapse
-- into a single row (hit_count). The daily cron emails the owner a digest of
-- NEW unresolved misses, and Admin → Broken Links turns any row into a 301 by
-- inserting into the existing `redirects` table (which src/proxy.ts already
-- consults) — a fix that goes live with no deploy.
-- ============================================================================

create table if not exists public.not_found_log (
  id              uuid primary key default gen_random_uuid(),
  path            text not null unique,            -- "/product-tag/acidity" (leading slash, no host/query)
  hit_count       integer not null default 1,
  first_seen      timestamptz not null default now(),
  last_seen       timestamptz not null default now(),
  last_referer    text,
  last_user_agent text,
  is_bot          boolean not null default false,  -- best-effort UA classification
  resolved        boolean not null default false,  -- true once a redirect is added or it's dismissed
  alerted_at      timestamptz                      -- set when included in a digest email (dedupes alerts)
);

-- The admin list and the digest both scan unresolved rows newest-first.
create index if not exists not_found_log_open_idx
  on public.not_found_log (resolved, last_seen desc);

alter table public.not_found_log enable row level security;
-- No policies: only the service-role server client (supabaseAdmin) and the
-- SECURITY DEFINER logger below touch this table. Never exposed to anon.

-- Atomic upsert+increment. SECURITY DEFINER so the logger can run under any
-- key; the storefront calls it through the service-role client in after().
create or replace function public.log_not_found(
  p_path text,
  p_referer text,
  p_user_agent text,
  p_is_bot boolean
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.not_found_log (path, last_referer, last_user_agent, is_bot)
  values (p_path, p_referer, p_user_agent, coalesce(p_is_bot, false))
  on conflict (path) do update set
    hit_count       = public.not_found_log.hit_count + 1,
    last_seen       = now(),
    last_referer    = coalesce(excluded.last_referer, public.not_found_log.last_referer),
    last_user_agent = coalesce(excluded.last_user_agent, public.not_found_log.last_user_agent),
    is_bot          = excluded.is_bot;
$$;

grant execute on function public.log_not_found(text, text, text, boolean) to anon, authenticated, service_role;

-- ── Legacy 301 recovered from the GSC 404 drilldown ─────────────────────────
-- Destination verified live (200). This flat WP slug was missed by the importer
-- (the post exists at /blog/...); the proxy resolves it via this row, no deploy.
--
-- The rest of that 404 report is dead WordPress/Woo taxonomy (/product-tag/*,
-- /tag/* blog archives) with no real equivalent — correctly left as 404 (a 404
-- for removed content is not a ranking problem; redirecting them to /shop or an
-- empty /tag would read as soft-404).
--
-- NOTE: the misspelled product slug /product/maritxizer-syrup is intentionally
-- NOT redirected here. /product/* is an "owned" path (src/proxy.ts isOwnedPath),
-- so the proxy never consults this table for it; combined with the PDP's
-- loading.tsx, an unknown product slug streams a *noindexed* soft-404 that a
-- redirect can't cleanly convert to a 301. Since it's noindexed Google won't
-- index it — an accepted trade-off, not worth removing the PDP skeleton for.
insert into public.redirects (from_path, to_path, source) values
  ('/improve-egg-quality-pakistan',  '/blog/improve-egg-quality-pakistan', 'admin')   -- flat WP slug missed by the importer; post exists
on conflict (from_path) do nothing;
