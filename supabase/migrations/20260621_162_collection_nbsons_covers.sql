-- ============================================================================
-- Reuse NB Sons collection cover banners on the matching Yellow Pink
-- collections. NB Sons (nbsons.com) is the in-house supplement brand, so its
-- own collection artwork is first-party and free to reuse. Only three NB Sons
-- collections carry a cover image, and each maps cleanly to a wellness/skincare
-- collection here:
--   Human Health     → Wellness & Supplements   (wellness)
--   Immunity Booster → Immunity & Defence        (immunity-defence)
--   Skin Care        → The Skincare Edit         (skincare-edit)
--
-- Hot-linked from the NB Sons Shopify CDN (cdn.shopify.com is allow-listed in
-- next.config.ts). This avoids pointing prod at a /public asset that isn't on
-- main yet. Idempotent; only updates the hero image.
-- ============================================================================

update collections set hero_image_url =
  'https://cdn.shopify.com/s/files/1/0723/5597/1257/collections/Human_Health_1920x_3100f8a7-4941-4340-b3bd-abfc0553955f.webp?v=1780293927',
  updated_at = now() where slug = 'wellness';

update collections set hero_image_url =
  'https://cdn.shopify.com/s/files/1/0723/5597/1257/collections/Immunity_Booster-01.jpg?v=1773129597',
  updated_at = now() where slug = 'immunity-defence';

update collections set hero_image_url =
  'https://cdn.shopify.com/s/files/1/0723/5597/1257/collections/Skincare_Banner_2.jpg?v=1780294036',
  updated_at = now() where slug = 'skincare-edit';
