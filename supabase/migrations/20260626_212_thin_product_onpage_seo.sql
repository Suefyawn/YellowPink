-- On-page SEO pass for the 15 PUBLISHED products that the descriptive-name
-- batch (#211) missed or that still carried thin/duplicated meta.
--
-- Three gaps fixed here:
--   1. Bare H1/JSON-LD `name` — products whose only qualifier was a dosage
--      form ("M-Sol Sachet", "Simdac Drops", "Kidogest Drops") or a single
--      brand token ("Simfolic", "Cee"). #211 wrongly treated the form word
--      ("Sachet"/"Drops") as descriptive and skipped them; Simfolic has a
--      null brand so the NB-Sons-scoped #211 never saw it at all.
--   2. Bare `seo_title` (<25 chars / generic "Buy X in Pakistan") on six
--      products — the <title> tag itself was unoptimised.
--   3. Off-topic DUPLICATE `seo_description`: a face wash, an intimate wash and
--      a serum all shared "Explore best nutritional supplements…" boilerplate
--      (irrelevant + duplicate meta). Rewritten to unique, on-topic copy.
--
-- All copy is grounded in each product's own body description — no invented
-- claims. URLs unchanged (separate `slug`). Applied to prod.

-- ── 1. Name enrichment (drives <h1>, Product JSON-LD name, breadcrumbs) ──
update products set name = 'AquaColor Face & Body Paint Base'              where slug = 'aquacolor-base';
update products set name = 'Argivital L-Arginine Heart & Circulation Sachet' where slug = 'argivital-sachet';
update products set name = 'Cee Chewable Vitamin C 500mg Tablets'          where slug = 'cee';
update products set name = 'F.lium Folic Acid Drops for Kids'              where slug = 'f-lium-drops';
update products set name = 'Kidogest Herbal Colic Drops for Babies'        where slug = 'kidogest-drops';
update products set name = 'M-Sol Myo-Inositol Sachet for PCOS & Fertility' where slug = 'm-sol-sachet';
update products set name = 'Pixi LipGlow Tinted Lip Balm'                  where slug = 'pixi-lipglow';
update products set name = 'Simdac Vitamin A, D3 & C Drops for Kids'       where slug = 'simdac-drops';
update products set name = 'Simfolic Myo-Inositol + Folic Acid for PCOS'   where slug = 'simfolic';
update products set name = 'Vitamin C Brightening Face Serum'             where slug = 'vitamin-c-serum';

-- ── 2. seo_title fixes (the <title> tag) ──
update products set seo_title = 'Kidogest Colic Drops for Babies — Gas & Colic Relief (PK)' where slug = 'kidogest-drops';
update products set seo_title = 'Hydrating Face Wash — Gentle Daily Cleanser (PK)'          where slug = 'hydrating-face-wash';
update products set seo_title = 'Nutrifactor Ginseng 250mg — Energy & Focus, Price in Pakistan' where slug = 'ginseng';
update products set seo_title = 'Rivaj UK Volume Strength Mascara — Price in Pakistan'       where slug = 'mascara';
update products set seo_title = 'Rooposh Feminine Wash — Gentle pH-Balanced Intimate Wash (PK)' where slug = 'rooposh-feminine-wash';
update products set seo_title = 'Vitamin C Brightening Face Serum — NB Sons, Price in Pakistan' where slug = 'vitamin-c-serum';

-- ── 3. seo_description rewrites (off-topic duplicate boilerplate + truncated) ──
update products set seo_description =
  'A gentle, hydrating daily face wash that lifts away dirt, oil and impurities without stripping the skin — leaving it soft, fresh and comfortably clean. Authentic, cash on delivery across Pakistan.'
  where slug = 'hydrating-face-wash';
update products set seo_description =
  'Rooposh is a soap-free, pH-balanced feminine intimate wash for daily freshness — it cleanses delicately while respecting the body''s natural balance. Authentic, cash on delivery across Pakistan.'
  where slug = 'rooposh-feminine-wash';
update products set seo_description =
  'A lightweight Vitamin C facial serum that brightens dull, tired skin, fades dark spots and uneven tone, and defends against daily pollution with antioxidant protection. Authentic, cash on delivery across Pakistan.'
  where slug = 'vitamin-c-serum';
update products set seo_description =
  'Kidogest herbal colic drops for infants and young children — cumin, fennel, peppermint, ginger and cardamom to ease gas, bloating and everyday tummy discomfort. Authentic, cash on delivery across Pakistan.'
  where slug = 'kidogest-drops';
