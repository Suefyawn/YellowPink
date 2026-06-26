-- Enrich NB Sons product names from bare brand tokens ("Meth D", "MORR",
-- "Gluthic") to descriptive form ("Meth-D Vitamin B12 + D3 Tablets", "MORR
-- Moringa Supplement", "Gluthic Glutathione 500mg + Vitamin C").
--
-- Why: `name` drives the visible PDP <h1>, the Product JSON-LD `name`, and the
-- breadcrumb trail. Those currently render the cryptic internal brand token,
-- while the (already keyword-rich) `seo_title` carries the descriptive copy.
-- Our direct competitor for these exact branded queries (vitahub.pk) uses
-- descriptive product H1s; this closes that on-page gap. The <title> tag is
-- unchanged (it reads from seo_title), and URLs are unchanged (separate `slug`
-- column). New names are derived from each product's vetted seo_title +
-- description — no invented ingredient claims.
--
-- Idempotent: keyed by slug, scoped to brand = 'NB Sons'. Re-running is a no-op
-- once names already match (the WHERE on the old token guards against clobbering
-- a later manual edit).

update products p
set name = v.new_name
from (values
  ('argivital',        'Argivital Heart & Circulation Sachet'),
  ('calco-fit',        'Calco Fit Magnesium Glycinate 500mg'),
  ('calco-fit-vit-kd', 'Calco Fit + Vit KD Bone & Magnesium Bundle'),
  ('citowit',          'Citowit Ginkgo & Ginseng Brain Supplement'),
  ('energy-boost',     'Energy Boost Multivitamin & Mineral Tablets'),
  ('femeez',           'FEMEEZ Menstrual Wellness Blend'),
  ('femeez-citowit',   'Femeez + Citowit Women''s Balance & Focus Bundle'),
  ('ferosim',          'Ferosim Iron Supplement & Syrup'),
  ('finkuff',          'FINKuff Cough Syrup for Adults & Kids'),
  ('flex-4',           'Flex-4 Men''s Vitality Tablets'),
  ('fol-chew',         'FOL Chew Chewable Folate Fertility Support'),
  ('fybosim',          'Fybosim Natural Fibre Supplement'),
  ('gluthic',          'Gluthic Glutathione 500mg + Vitamin C'),
  ('gluthic-cee',      'Gluthic + CEE Glutathione & Vitamin C Skin Bundle'),
  ('greelac',          'Greelac Lactation Support Supplement'),
  ('leukaz',           'LEUKAZ Women''s Reproductive Wellness Support'),
  ('meth-d',           'Meth-D Vitamin B12 + D3 Tablets'),
  ('meth-d-ultrapin',  'Meth-D + Ultrapin Nerve Support & Pain Relief Bundle'),
  ('morr',             'MORR Moringa Supplement'),
  ('movin',            'Movin Maternal Nutrition for Pregnancy & Lactation'),
  ('nb-cal',           'NB CAL Calcium Antacid for Acidity & Gas'),
  ('puratin',          'Puratin Melatonin 4mg Sleep Aid'),
  ('repro-f',          'Repro-F Women''s Fertility Supplement'),
  ('repro-m',          'Repro-M Men''s Fertility Supplement'),
  ('semofer',          'Semofer Iron Drops for Kids'),
  ('stevoice',         'Stevoice Stevia Zero-Calorie Sweetener'),
  ('syror',            'Syror Soy Isoflavones Menopause Support'),
  ('trimo-m',          'Trimo-M Ashwagandha Men''s Vitality Tablets'),
  ('ultrapin',         'Ultrapin Pain-Relief Cream for Muscles & Joints'),
  ('vit-kd',           'Vit KD Vitamin D3 10,000 IU + K2'),
  ('x-fit',            'X-Fit Men''s Vitality Tablets'),
  ('x-fit-trimo-m',    'X-Fit + Trimo-M Complete Male Vitality Stack')
) as v(slug, new_name)
where p.slug = v.slug
  and p.brand = 'NB Sons'
  and p.name <> v.new_name;
