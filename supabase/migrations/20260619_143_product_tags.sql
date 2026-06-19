-- ============================================================================
-- Many-to-many product tags (WooCommerce / Shopify style).
--
-- The single products.tag text column was an unused single-badge field; brand,
-- category and variant-attribute facets already exist. This adds a proper,
-- arbitrary, reusable tag system so one product can carry many merchandising
-- tags (viral, vegan, gift, fragrance-free, …) that power storefront faceted
-- filtering and, later, curated collections.
--
-- Additive: nothing here touches existing columns or behaviour.
-- ============================================================================

create table if not exists public.product_tags (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  created_at  timestamptz not null default now()
);

comment on table public.product_tags is
  'Reusable, free-form product tags for faceted filtering and curated edits. '
  'Distinct from products.tag (a legacy single-badge field).';

create table if not exists public.product_tag_map (
  product_id  uuid not null references public.products(id) on delete cascade,
  tag_id      uuid not null references public.product_tags(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (product_id, tag_id)
);

create index if not exists product_tag_map_tag_idx on public.product_tag_map (tag_id);

-- RLS: storefront (anon) reads tags + the join to render facets; every write
-- goes through the service-role admin client, which bypasses RLS.
alter table public.product_tags enable row level security;
alter table public.product_tag_map enable row level security;

create policy product_tags_read_all on public.product_tags for select using ( true );
create policy product_tag_map_read_all on public.product_tag_map for select using ( true );

grant select on public.product_tags, public.product_tag_map to anon, authenticated;
