-- Makeup audit: 4 published makeup products had brand = NULL despite the brand
-- being obvious from their seo_title — so they carried no brand in the Product
-- schema, were excluded from their /brand/<slug> archive pages and the brand
-- filter, and had awkward "X by Brand" H1s. Fix the two unambiguous ones (the
-- seo_title names an established brand we already stock) with the correct brand
-- + a brand-led name so brandPlusName()/stripBrandPrefix() produce clean output.
--
-- Left for owner confirmation (ambiguous brand — could be generic/dupe, not
-- guessed here): milk-jelly-tints, aquacolor-base.

update products set brand = 'Real Techniques', name = 'Real Techniques Blush Brush 400'
where slug = 'blush-brush-by-real-techniques' and status = 'published';

update products set brand = 'PIXI', name = 'Pixi Superglow Highlighter Sticks'
where slug = 'highlighter-sticks-by-pixi' and status = 'published';
