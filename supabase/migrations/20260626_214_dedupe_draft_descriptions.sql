-- Differentiate the draft products whose body-derived seo_description (from
-- migration 213) collided with a sibling's. The collisions are genuine product
-- families that share marketing copy — shade variants (Hello Hair colours),
-- pack-size variants (Pack of 2/3/5, 30g/60g, Bulk) and editions (Legacy
-- Edition). The differentiator already lives in each product's name, so lead
-- the description with the name and re-clamp to ~160 chars at a word boundary.
-- Result: unique meta per variant that also surfaces the specific shade/pack.
--
-- Scope guard: only drafts in a duplicate-description group, and skip rows whose
-- description already starts with the name (the migration-213 short-body
-- fallback already leads with the name, so it's unique and must not be doubled).
-- Drafts aren't indexed; this is a pre-publish cleanup.

with dups as (
  select seo_description as sd
  from products
  where status = 'draft'
  group by seo_description
  having count(*) > 1
)
update products p
set seo_description = case
  when length(trim(p.name) || ' — ' || p.seo_description) <= 165
    then trim(p.name) || ' — ' || p.seo_description
  else regexp_replace(left(trim(p.name) || ' — ' || p.seo_description, 162), '\s+\S*$', '') || '…'
end
from dups
where p.status = 'draft'
  and p.seo_description = dups.sd
  and left(p.seo_description, length(trim(p.name))) <> trim(p.name);

-- One duplicate seo_title remained: two "Multivitamin Massage Cream" SKUs (a
-- jar and a 50g format). Qualify the jar variant (confirmed by its slug) so the
-- titles differ; the other's exact format is left for the owner to set at
-- publish time rather than guessed.
update products
set seo_title = 'Multivitamin Massage Cream (Jar) – Price in Pakistan'
where slug = 'multivitamin-massage-cream-jar' and status = 'draft';
