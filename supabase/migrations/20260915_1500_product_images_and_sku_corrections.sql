-- Official brand packshots for the published hair products, plus the SKU
-- corrections that sourcing them exposed.
-- =======================================================================
--
-- The owner asked for images from vendor sites. These are the brands' own
-- official packshots, which is what a retailer uses and what a distributor
-- would send in an asset pack; see docs/PRODUCT-IMAGES.md for the sourcing
-- position. Fetched from cerave.com and ogxbeauty.co.uk / ogxbeauty.com,
-- cropped square on white at 1200x1200 webp by scripts/product-image-prep.py,
-- and committed under public/product-images/ (the same convention as
-- public/blog-heroes/, and a path the /img resizer already allows).
--
-- The CeraVe packshots ship with a "#1 dermatologist recommended" badge and a
-- US survey footnote. Both are cropped away: they are marketing furniture
-- rather than the product, the footnote is illegible at tile size, and a US
-- market claim is not one this store should be republishing in Pakistan.
--
-- LOOKING AT THE REAL BOTTLES CAUGHT TWO MISTAKES OF MINE.
--
-- Sizes. I invented "236ml" for both CeraVe lines when drafting them. The
-- actual bottles are 12 FL OZ (355ml) for the shampoo and 9 FL OZ (266ml) for
-- the conditioner. Shipping an image whose label contradicts the product name
-- is the "wrong packaging" failure docs/PRODUCT-IMAGES.md warns about, and on
-- cash on delivery it is a refusal at the door. The names are corrected here.
-- The four OGX bottles really are 385ml, so those listings were right.
--
-- Discontinued stock. OGX has discontinued the Teatree Mint line:
-- ogxbeauty.com/products/teatree-mint-shampoo now 301s to
-- /discontinued/teatree-mint-shampoo. I drafted that SKU and it was published
-- an hour ago. A discontinued line cannot be reliably sourced, so it goes back
-- to draft rather than collecting orders that cannot be filled, and the
-- reference added to the shampoo article is removed with it.
--
-- Still without an image: La Roche-Posay Kerium DS. Both laroche-posay.co.uk
-- and .com refuse automated requests (403), so it keeps the monogram tile
-- until the distributor sends an asset pack.

update public.products set image_url = '/product-images/' || slug || '.webp', updated_at = now()
where slug in (
  'cerave-anti-dandruff-hydrating-shampoo',
  'cerave-anti-dandruff-hydrating-conditioner',
  'ogx-argan-oil-of-morocco-shampoo',
  'ogx-argan-oil-of-morocco-conditioner',
  'ogx-biotin-collagen-shampoo',
  'ogx-biotin-collagen-conditioner'
);

update public.products
set name = 'CeraVe Anti-Dandruff Hydrating Shampoo 355ml', updated_at = now()
where slug = 'cerave-anti-dandruff-hydrating-shampoo';

update public.products
set name = 'CeraVe Anti-Dandruff Hydrating Conditioner 266ml', updated_at = now()
where slug = 'cerave-anti-dandruff-hydrating-conditioner';

update public.products set status = 'draft', updated_at = now()
where slug = 'ogx-tea-tree-mint-shampoo';

update public.blog_posts set body = replace(body,
  'The clarifying bottle we stock is <a class="blog-product-link" href="/product/ogx-tea-tree-mint-shampoo">OGX Hydrating + Tea Tree Mint</a> ([[price:ogx-tea-tree-mint-shampoo]]), though tea tree is not a substitute for zinc pyrithione once dandruff is properly established.',
  'We do not stock a clarifying shampoo for oily scalps at the moment, and a moisturising bottle is not a substitute for one.'),
  updated_at = now()
where slug = 'best-shampoo-in-pakistan';

update public.blog_posts set body = replace(body,
  '>CeraVe Anti-Dandruff Hydrating</a> (236ml)</td>',
  '>CeraVe Anti-Dandruff Hydrating</a> (355ml)</td>'),
  updated_at = now()
where slug = 'best-shampoo-in-pakistan';
