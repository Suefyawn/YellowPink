-- ============================================================================
-- Search-synonym map — recover demand lost to naming mismatches.
--
-- The Search-demand report surfaces on-site searches that return NO products.
-- A big share of those aren't missing stock, they're vocabulary gaps: a
-- shopper types "vit c" but the catalogue says "Vitamin C"; "sunblock" but we
-- name it "sunscreen". This table maps a searched term to the query that
-- actually finds products, and search_products() consults it so the rewrite
-- happens for EVERY search path (header typeahead, /shop search, and the
-- Search-demand cross-check) from one place.
--
-- Security: RLS on with no policies. The storefront never touches this table
-- directly, it only calls search_products(), which is SECURITY DEFINER and so
-- reads the map regardless of RLS. The admin UI writes via the service role
-- (supabaseAdmin), which bypasses RLS. So no policy is needed or wanted.
-- ============================================================================

create table if not exists public.search_synonyms (
  term       text primary key,               -- what shoppers type (lower, trimmed)
  canonical  text not null,                  -- the query to search instead
  note       text,                           -- optional admin note ("why")
  created_at timestamptz not null default now()
);

alter table public.search_synonyms enable row level security;

comment on table public.search_synonyms is
  'Maps a searched term to the query that actually returns products. Consulted by search_products(). Managed from Admin -> Search demand.';

-- Rewrite the query through the synonym map before scoring. Only the `q` CTE
-- changes, the scoring/ranking below is byte-for-byte the previous version.
create or replace function public.search_products(p_query text, p_limit integer default 8)
 returns table(id uuid, brand text, name text, slug text, price numeric, image_url text, category text, similarity real)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with q as (
    select coalesce(
      (select s.canonical from public.search_synonyms s where s.term = lower(trim(p_query)) limit 1),
      trim(p_query)
    ) as q
  ),
  scored as (
    select
      p.id, p.brand, p.name, p.slug, p.price, p.image_url, p.category,
      p.created_at, p.is_bestseller, p.review_count, p.rating,
      greatest(
        similarity(p.name,  (select q from q)),
        similarity(p.brand, (select q from q)),
        case when coalesce(p.category, '')    ilike '%' || (select q from q) || '%' then 0.5  else 0 end,
        case when coalesce(p.subcategory, '') ilike '%' || (select q from q) || '%' then 0.5  else 0 end,
        case when coalesce(p.short_description, p.description, '') ilike '%' || (select q from q) || '%' then 0.35 else 0 end
      )::real as sim
    from public.products p
    where (select q from q) <> ''
      and (
        p.name  ilike '%' || (select q from q) || '%'
        or p.brand ilike '%' || (select q from q) || '%'
        or coalesce(p.category, '')    ilike '%' || (select q from q) || '%'
        or coalesce(p.subcategory, '') ilike '%' || (select q from q) || '%'
        or coalesce(p.short_description, p.description, '') ilike '%' || (select q from q) || '%'
        or p.name  % (select q from q)
        or p.brand % (select q from q)
      )
      and (p.status is null or p.status = 'published')
  )
  select id, brand, name, slug, price, image_url, category, sim as similarity
  from scored
  order by
    (
      sim
      + case when is_bestseller then 0.06 else 0 end
      + least(coalesce(review_count, 0), 100)::real / 100 * 0.05
      + coalesce(rating, 0)::real / 5 * 0.03
    ) desc,
    sim desc,
    created_at desc nulls last
  limit greatest(1, least(p_limit, 50));
$function$;
