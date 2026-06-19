-- ============================================================================
-- Collections (Shopify-style curated product groups).
--
-- A collection is a merchandised grouping with its own landing page
-- (/collection/[slug]). Two kinds:
--   • manual — an explicit, hand-ordered product list (collection_products).
--   • smart  — a rule set (rules jsonb) evaluated against the catalogue, so the
--     membership stays current automatically (e.g. tag=viral AND price<=3000).
--
-- Additive and independent of categories / brands / tags, which all keep
-- working unchanged.
-- ============================================================================

create table if not exists public.collections (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  description     text,
  hero_image_url  text,
  type            text not null default 'manual' check (type in ('manual', 'smart')),
  rules           jsonb not null default '{}'::jsonb,
  status          text not null default 'published' check (status in ('published', 'draft')),
  sort_order      integer not null default 0,
  seo_title       text,
  seo_description text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.collections is
  'Merchandised product groupings with their own landing page. type=manual uses '
  'collection_products; type=smart evaluates the rules jsonb against the catalogue.';

create table if not exists public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  position      integer not null default 0,
  primary key (collection_id, product_id)
);

create index if not exists collection_products_collection_idx on public.collection_products (collection_id);

-- RLS: the storefront (anon) may read PUBLISHED collections + their product
-- links; the admin reads drafts via the service role (which bypasses RLS).
alter table public.collections enable row level security;
alter table public.collection_products enable row level security;

create policy collections_read_published on public.collections for select using ( status = 'published' );
create policy collection_products_read_all on public.collection_products for select using ( true );

grant select on public.collections, public.collection_products to anon, authenticated;
