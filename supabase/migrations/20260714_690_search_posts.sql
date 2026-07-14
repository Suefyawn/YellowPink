-- ============================================================================
-- Article search — journal posts join the site search.
--
-- Search was products-only: someone typing "elevit" (an imported prenatal
-- brand we don't stock) got a dead "No results" screen even though the
-- journal has a dedicated "Elevit Alternative in Pakistan" guide. This RPC
-- lets the header typeahead and the /shop?q= results page surface matching
-- articles alongside (or instead of) products.
--
-- Synonym handling mirrors search_products(): the query is rewritten through
-- search_synonyms, BUT posts are matched against BOTH the raw and the
-- rewritten term. Rationale: the map exists to route product vocabulary
-- ("elevit" → "prenatal" so the alternatives surface), yet the article that
-- mentions the raw brand name by title must still match the raw term.
-- ============================================================================

create or replace function public.search_posts(p_query text, p_limit integer default 3)
 returns table(slug text, title text, excerpt text, image_url text, read_time text, similarity real)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with raw as (
    select trim(p_query) as t
  ),
  q as (
    select coalesce(
      (select s.canonical from public.search_synonyms s where s.term = lower((select t from raw)) limit 1),
      (select t from raw)
    ) as q
  ),
  scored as (
    select
      b.slug, b.title, b.excerpt, b.image_url, b.read_time::text as read_time, b.date,
      greatest(
        similarity(b.title, (select t from raw)),
        similarity(b.title, (select q from q)),
        case when b.title ilike '%' || (select t from raw) || '%'
               or b.title ilike '%' || (select q from q) || '%' then 0.8 else 0 end,
        case when coalesce(b.excerpt, '') ilike '%' || (select t from raw) || '%'
               or coalesce(b.excerpt, '') ilike '%' || (select q from q) || '%' then 0.5 else 0 end,
        case when coalesce(b.topic, '') ilike '%' || (select t from raw) || '%'
               or coalesce(b.topic, '') ilike '%' || (select q from q) || '%' then 0.4 else 0 end,
        -- Body matches rank lowest: a passing mention shouldn't outrank a
        -- title hit. Catalogue is ~dozens of posts, so ilike over body is fine.
        case when b.body ilike '%' || (select t from raw) || '%' then 0.25 else 0 end
      )::real as sim
    from public.blog_posts b
    where (select t from raw) <> ''
  )
  select slug, title, excerpt, image_url, read_time, sim as similarity
  from scored
  where sim >= 0.25
  order by sim desc, date desc nulls last
  limit greatest(1, least(p_limit, 10));
$function$;

-- Per migration 130's convention SECURITY DEFINER functions are locked down
-- by default; this one is deliberately public — it powers the storefront
-- search box via the anon client and reads only published editorial content.
grant execute on function public.search_posts(text, integer) to anon, authenticated;

comment on function public.search_posts is
  'Storefront article search: pg_trgm + ilike over blog_posts (title/excerpt/topic/body), synonym-aware like search_products(). Called by the header typeahead and /shop?q=.';
