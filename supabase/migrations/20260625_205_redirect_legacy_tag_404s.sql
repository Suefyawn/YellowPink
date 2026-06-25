-- ============================================================================
-- Redirect the legacy WordPress taxonomy 404s from Search Console's
-- "Not found (404)" report.
--
-- These are old /product-tag/* and /tag/* URLs Google still crawls; none has a
-- live product_tag equivalent (the taxonomy wasn't migrated). The proxy now
-- funnels /product-tag/<slug>/… → /tag/<slug>, and the /tag/[slug] route
-- honours these rows at its 404 boundary (lib/redirects.redirectIfMapped), so
-- a single /tag/<slug> row covers both URL shapes.
--
-- Each themed tag points at the closest live category landing; genuinely
-- generic ones (sugar-free, effervescent, a product form) go to /shop. A
-- discontinued product (maritxizer-syrup) goes to /shop too.
-- ============================================================================

insert into public.redirects (from_path, to_path, status_code, source) values
  -- Women's health / PCOS / fertility
  ('/tag/managing-pcos-symptoms-naturally', '/shop?category=women-s-health', 301, 'admin'),
  ('/tag/hormonal-balance',                 '/shop?category=women-s-health', 301, 'admin'),
  ('/tag/natural-pcos-cure',                '/shop?category=women-s-health', 301, 'admin'),
  ('/tag/preconception-health',             '/shop?category=women-s-health', 301, 'admin'),
  ('/tag/myo-inositol-and-folic-acid',      '/shop?category=women-s-health', 301, 'admin'),
  ('/tag/menopause',                        '/shop?category=women-s-health', 301, 'admin'),
  ('/tag/urinary-health',                   '/shop?category=women-s-health', 301, 'admin'),
  -- Men's health
  ('/tag/natural-testosterone-boosters',    '/shop?category=men-s-health',   301, 'admin'),
  ('/tag/healthy-aging-for-men',            '/shop?category=men-s-health',   301, 'admin'),
  ('/tag/stamina-booster-for-men-pakistan', '/shop?category=men-s-health',   301, 'admin'),
  -- Other clear themes
  ('/tag/child-health',                     '/shop?category=kids',           301, 'admin'),
  ('/tag/vitamin-c',                        '/shop?category=immunity',       301, 'admin'),
  ('/tag/acidity',                          '/shop?category=digestive-gut',  301, 'admin'),
  ('/tag/mucus-relief',                     '/shop?category=cough-respiratory', 301, 'admin'),
  -- Generic / product-form tags → all products
  ('/tag/iron-supplement',                  '/shop', 301, 'admin'),
  ('/tag/sugar-free',                       '/shop', 301, 'admin'),
  ('/tag/effervescent',                     '/shop', 301, 'admin'),
  ('/tag/stress-calm-aid',                  '/shop', 301, 'admin'),
  -- Discontinued product
  ('/product/maritxizer-syrup',             '/shop', 301, 'admin')
on conflict (from_path) do nothing;
