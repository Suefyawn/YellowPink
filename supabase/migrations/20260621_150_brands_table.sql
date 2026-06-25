-- ============================================================================
-- Brands as a first-class entity.
--
-- Until now "brand" was just the `products.brand` text column — fine for
-- filtering, but no logo, no per-brand copy, no SEO, no admin surface. This
-- migration adds a metadata table layered ON TOP of the existing column:
--   • Loosely coupled — products.brand stays a free text column; a brand row
--     is optional. The join is by `slug` matched against brandSlug(name).
--   • `status` lets us draft a brand (typing the copy) without exposing the
--     landing-page hero before it's ready. The brand string on products still
--     resolves normally; only the rich landing-page surface gates on this.
--   • Soft constraints on visible status + sort_order mirror `collections`.
-- ============================================================================

create table if not exists public.brands (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,                          -- canonical URL key, matches brandSlug(name)
  name            text not null,                                  -- display name, matches products.brand string
  description     text,                                           -- shown on landing page hero
  logo_url        text,                                           -- square/round logo for the index grid
  hero_image_url  text,                                           -- wide hero behind the brand title on /brand/[slug]
  status          text not null default 'published' check (status in ('draft','published')),
  sort_order      integer not null default 0,
  seo_title       text,
  seo_description text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists brands_status_sort_idx on public.brands (status, sort_order, name);

drop trigger if exists brands_set_updated_at on public.brands;
create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

alter table public.brands enable row level security;

-- Public can read PUBLISHED brands only (drafts stay hidden until the owner
-- finishes the copy). Admin writes via the service-role client like the
-- collections + products tables.
drop policy if exists brands_anon_select_published on public.brands;
create policy brands_anon_select_published on public.brands
  for select using ( status = 'published' );
