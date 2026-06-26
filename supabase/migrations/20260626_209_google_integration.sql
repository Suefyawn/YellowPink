-- ============================================================================
-- Google account connection (owner-level) for live Search Console + GA4 data.
--
-- The owner connects their Google account once via OAuth ("Connect Google" in
-- Settings → Integrations); we keep the refresh token here (encrypted at the
-- app layer) and the chosen GSC site + GA4 property, so the admin can pull
-- live search-performance and analytics data instead of uploading CSVs.
--
-- Single row (id is a constant true). RLS is locked — there are no policies, so
-- only the service-role client (server-side) can read/write it; tokens never
-- reach the browser.
-- ============================================================================

create table if not exists public.google_integration (
  id              boolean primary key default true check (id),  -- enforces one row
  email           text,                       -- the connected Google account
  refresh_token   text,                       -- AES-256-GCM, base64 (app-encrypted)
  access_token    text,                       -- cached short-lived token (encrypted)
  token_expiry    timestamptz,
  scopes          text[] not null default '{}',
  gsc_site_url    text,                        -- e.g. "sc-domain:yellowpink.pk" or a URL-prefix
  ga4_property_id text,                        -- numeric GA4 property id
  ga4_property_name text,
  connected_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.google_integration enable row level security;
