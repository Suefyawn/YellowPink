-- ============================================================================
-- Draft product scaffolds for the three catalogue gaps. status='draft' keeps
-- them OUT of the storefront, sitemap and feeds (anon RLS + those builders
-- filter to 'published'), so nothing is purchasable or indexable. They exist
-- as ready-to-publish stubs with keyword-aware seo_title/seo_description; the
-- owner sets a real price, stock, image and description, then flips to
-- published. Demand + suggested specs live in docs/CATALOGUE-GAPS.md.
-- price is a required column with no default → 0 placeholder (a draft is never
-- charged). Idempotent: delete-by-slug then insert.
-- ============================================================================

delete from products where slug in ('collagen-peptides-powder', 'omega-3-fish-oil', 'biotin-10000-mcg') and status = 'draft';

insert into products (name, slug, price, stock, category, status, track_inventory, seo_title, seo_description, description) values
(
  'Collagen Peptides Powder',
  'collagen-peptides-powder',
  0, 0, 'Women''s Health', 'draft', false,
  'Buy Collagen Powder & Supplements in Pakistan',
  'Shop hydrolysed collagen peptides in Pakistan — marine or bovine, for skin, hair, nails and joints. Authentic, with cash on delivery nationwide.',
  'DRAFT placeholder — pending sourcing. Set a real price, stock, product image and full description, then publish. Suggested spec: hydrolysed marine or bovine collagen peptides, powder (sachets/tub) and/or capsules. Demand: ~29k PK searches/mo (see docs/CATALOGUE-GAPS.md).'
),
(
  'Omega-3 Fish Oil',
  'omega-3-fish-oil',
  0, 0, 'Heart Health', 'draft', false,
  'Buy Omega-3 Fish Oil in Pakistan — EPA & DHA',
  'Shop omega-3 fish oil in Pakistan — softgels with stated EPA and DHA for heart, brain and joint health. Authentic, with cash on delivery nationwide.',
  'DRAFT placeholder — pending sourcing. Set a real price, stock, product image and full description, then publish. Suggested spec: fish-oil softgels (e.g. 1000mg with stated EPA/DHA); consider an algal/vegetarian variant. Demand: ~17k PK searches/mo (see docs/CATALOGUE-GAPS.md).'
),
(
  'Biotin 10,000mcg',
  'biotin-10000-mcg',
  0, 0, 'Hair Care', 'draft', false,
  'Buy Biotin for Hair, Skin & Nails in Pakistan',
  'Shop biotin (vitamin B7) in Pakistan — high-strength tablets for hair, skin and nails. Authentic, with cash on delivery nationwide.',
  'DRAFT placeholder — pending sourcing. Set a real price, stock, product image and full description, then publish. Suggested spec: standalone biotin 5,000–10,000mcg tablets/gummies; optional hair-skin-nails blend (biotin + zinc + collagen). Demand: ~9k PK searches/mo (see docs/CATALOGUE-GAPS.md).'
);
