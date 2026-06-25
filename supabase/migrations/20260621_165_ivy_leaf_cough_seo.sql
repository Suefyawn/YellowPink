-- ============================================================================
-- Capture the "ivy leaf cough syrup" demand (PK ~880/mo, competition 0.01 —
-- very winnable) on the two products that already cover it. docs/SEO-KEYWORDS
-- had listed ivy-leaf cough syrup as a *catalogue gap*, but it is in fact
-- stocked (Simrid + Pelargonium); this is an SEO/findability fix, not a SKU gap.
--
-- Also corrects the "Pelagonium" → "Pelargonium" spelling in the product name
-- (the description already spells the botanical correctly, so the name was a
-- typo) and tidies its casing. seo_title/seo_description drive the PDP title +
-- meta description (see product/[slug]/page.tsx generateMetadata).
-- Idempotent: plain UPDATEs keyed by slug.
-- ============================================================================

update products set
  seo_title = 'Simrid Ivy Leaf Cough Syrup & Drops — Pakistan',
  seo_description = 'Simrid ivy leaf cough syrup eases a chesty cough and clears mucus, for adults and kids. Authentic, PKR 250, with cash on delivery across Pakistan.'
where slug = 'simrid';

update products set
  name = 'Pelargonium Ivy Leaf',
  seo_title = 'Pelargonium & Ivy Leaf Cough Syrup — Pakistan',
  seo_description = 'Pelargonium sidoides with ivy leaf — a natural cough syrup for chest congestion and khansi (100mg). Authentic, PKR 350, cash on delivery in Pakistan.'
where slug = 'pelagonium-ivy-leaf';
