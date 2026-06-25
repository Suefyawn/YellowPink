-- ============================================================================
-- Seed landing-page hero images for the highest-traffic brands (by product
-- count). The image files ship in the repo under public/brands/<slug>-hero.webp
-- (Vercel-CDN-served), generated as original atmospheric, brand-appropriate
-- still lifes — ingredient/mood led, no brand marks, no product labels.
--
-- Non-destructive: only fills a hero that's currently empty, so an owner who
-- later uploads a real brand asset is never overwritten on re-run. The long
-- tail of brands keeps falling back to a representative product image.
-- Brand logos remain owner-uploadable and are intentionally not seeded.
-- ============================================================================

update public.brands as b
set hero_image_url = '/brands/' || b.slug || '-hero.webp'
where b.slug in (
  'pixi', 'cerave', 'medicube', 'beauty-of-joseon',
  'nars', 'sheglam', 'christine', 'anua'
)
and (b.hero_image_url is null or b.hero_image_url = '');
