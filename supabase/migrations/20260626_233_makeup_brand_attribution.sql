-- Brand attribution for two makeup products that imported with brand = null,
-- confirmed from the product details:
--   • milk-jelly-tints  → Milk Makeup (the "Cooling Water Jelly Tint", an
--     award-winning jelly lip + cheek stain). Rename to the accurate product
--     name so the brand-prefixed display isn't the redundant "Milk Makeup Milk
--     Jelly Tints".
--   • aquacolor-base    → Kryolan (AquaColor is Kryolan's professional
--     water-based face & body paint line).
-- Setting `brand` lights up /brand/milk-makeup and /brand/kryolan (derived from
-- products) and populates the Product JSON-LD `brand` field. SEO title/desc now
-- lead with the brand, which is how PK shoppers search ("milk makeup pakistan").

update products
set brand = 'Milk Makeup',
    name  = 'Cooling Water Jelly Tint',
    seo_title = 'Milk Makeup Cooling Water Jelly Tint, Pakistan',
    seo_description = 'Milk Makeup Cooling Water Jelly Tint, an award-winning, long-lasting jelly blush and lip stain with a hydrating, buildable finish. Cash on delivery across Pakistan.'
where slug = 'milk-jelly-tints';

update products
set brand = 'Kryolan',
    seo_title = 'Kryolan AquaColor Face & Body Paint, Pakistan',
    seo_description = 'Kryolan AquaColor is a professional water-based face and body paint that goes on in thin layers and sets with powder for a smooth, long-wear finish. Cash on delivery across Pakistan.'
where slug = 'aquacolor-base';
