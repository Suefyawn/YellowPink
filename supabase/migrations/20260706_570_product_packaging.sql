-- 570 · Product packaging attribute + auto "Perfume Testers" collection
--
-- Some genuine stock is supplied without full retail packaging (manufacturer
-- testers, or originals sold minus the box). We surface that condition honestly
-- across the storefront via a single product attribute, and merchandise the
-- fragrance testers into their own smart collection (buyers search "perfume
-- tester" ~1.5k/mo in PK; "without box" has ~no search demand, so it stays a
-- disclosure label rather than a category).
--
-- Values: 'standard' (default, normal boxed unit) · 'tester' (genuine
-- manufacturer tester, fragrances) · 'no_box' (original, without retail box).
-- Append-only + idempotent.

alter table products add column if not exists packaging text not null default 'standard';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_packaging_check') then
    alter table products add constraint products_packaging_check
      check (packaging in ('standard', 'tester', 'no_box'));
  end if;
end $$;

-- Partial index: only the (rare) non-standard rows are worth indexing, keeps
-- the "Perfume Testers" membership query and any packaging filter cheap.
create index if not exists idx_products_packaging on products (packaging) where packaging <> 'standard';

-- Auto-populated "Perfume Testers" smart collection. Created as a DRAFT so it
-- never renders an empty, thin page while no tester products exist yet — flip
-- it to Published from Admin → Collections once tester stock is flagged, and it
-- fills itself from the packaging='tester' rule.
insert into collections (slug, title, description, type, rules, status, sort_order, seo_title, seo_description)
select
  'perfume-testers',
  'Perfume Testers',
  'Genuine manufacturer perfume testers — the same original fragrance, supplied without full retail packaging, at a lower price. 100% authentic, with cash on delivery across Pakistan.',
  'smart',
  '{"match":"any","conditions":[{"field":"packaging","op":"in","value":["tester"]}]}'::jsonb,
  'draft',
  100,
  'Perfume Testers in Pakistan — 100% Original | Yellow Pink',
  'Shop genuine perfume testers in Pakistan at Yellow Pink. The same original fragrance, supplied without the retail box, at a lower price. Cash on delivery nationwide.'
where not exists (select 1 from collections where slug = 'perfume-testers');
