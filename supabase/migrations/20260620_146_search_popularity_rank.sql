-- Popularity-weighted product search.
--
-- search_products (pg_trgm) ranked purely by text similarity, then recency.
-- Two comparably-matching products (e.g. "serum") came back in an order that
-- ignored which one customers actually buy. This blends a MODEST popularity
-- boost — bestseller flag + review volume + rating — into the ordering so
-- proven sellers surface among similar matches, while strong text matches
-- still win (the boost maxes ~0.14 vs a similarity range of 0..1).
--
-- Return signature is unchanged (callers/types untouched); only ORDER BY
-- changes, plus a `scored` CTE so the popularity columns are in scope.
create or replace function public.search_products(p_query text, p_limit integer default 8)
 returns table(id uuid, brand text, name text, slug text, price numeric, image_url text, category text, similarity real)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with q as (select trim(p_query) as q),
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
