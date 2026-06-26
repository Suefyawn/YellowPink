-- Backfill seo_title + seo_description for the 348 DRAFT products that lack
-- them (mostly the Golden Pearl import). These aren't indexed yet, but this
-- makes them publish-ready instead of shipping with empty meta (which the
-- storefront would otherwise auto-fill with a generic fallback).
--
-- Grounded, not invented:
--   • seo_description is derived from each product's OWN body copy — newlines
--     collapsed, leading bullet/punctuation noise stripped, clamped to ~157
--     chars at a word boundary. Bodies shorter than 60 chars (a handful of
--     trade/wholesale packs whose copy is just logistics) fall back to a
--     templated authentic-{category}-with-COD line.
--   • seo_title is the product name, with "– Price in Pakistan" appended when
--     the name is short enough to keep the title under ~60 chars.
--
-- Scope guard: only drafts still missing a title, and NOT the catalogue-gap
-- placeholder rows (body starts with "DRAFT —"), whose body is an internal
-- note, never customer copy.

with cleaned as (
  select id, name, category,
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(description,''), '[\r\n\t]+', ' ', 'g'),
        '\s+', ' ', 'g'),
      '^[[:space:]•·\-–—.,:;*]+', '') as body
  from products
  where status = 'draft'
    and coalesce(nullif(trim(seo_title), ''), '') = ''
    and description not ilike 'DRAFT%'
)
update products p set
  seo_title = case
    when length(trim(p.name)) <= 45 then trim(p.name) || ' – Price in Pakistan'
    else trim(p.name)
  end,
  seo_description = case
    when length(c.body) < 60
      then trim(p.name) || ' — authentic ' || lower(c.category)
           || ' available at Yellow Pink, with cash on delivery across Pakistan.'
    when length(c.body) <= 160 then c.body
    else regexp_replace(left(c.body, 157), '\s+\S*$', '') || '…'
  end
from cleaned c
where p.id = c.id;
