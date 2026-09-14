-- One brand, one spelling.
--
-- products.brand is free text, and the catalogue had drifted: 7 products said
-- "PIXI" and 3 said "Pixi". The code paths are fixed to key on the slug so
-- casing can never split a brand again (src/lib/brands.ts), but the data should
-- still agree with itself: the admin brand filter, CSV exports and the
-- merchandising rules all group on the raw string.
--
-- Canonical spelling is taken from public.brands.name, which is the row the
-- brand page's own metadata comes from.
update public.products p
set brand = b.name, updated_at = now()
from public.brands b
where p.brand is not null
  and p.brand <> ''
  and b.status = 'published'
  and lower(trim(p.brand)) = lower(trim(b.name))
  and p.brand <> b.name;
