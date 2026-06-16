-- Post-migration fix: the wp_import redirects sent old /product-category/<slug>
-- URLs to /shop?cat=<old-slug>, but most old WordPress slugs don't match the
-- new category taxonomy, so they dead-ended on the unfiltered (beauty-heavy)
-- shop — severing the organic-search funnel that drove wellness orders.
-- Remap each to the correct new category slug (or its taxon where there's no
-- 1:1 equivalent), using the canonical ?category= / ?taxon= the shop resolves.
-- (Apostrophe categories slugify to women-s-health / men-s-health.)
update public.redirects r
set to_path = m.new_to
from (values
  ('/product-category/bone-health',                          '/shop?category=bone-joint'),
  ('/product-category/joint-health',                         '/shop?category=bone-joint'),
  ('/product-category/digestive-health',                     '/shop?category=digestive-gut'),
  ('/product-category/digestive-health-weight-management',   '/shop?category=digestive-gut'),
  ('/product-category/heart-cardiovascular',                 '/shop?category=heart-health'),
  ('/product-category/immune-support',                       '/shop?category=immunity'),
  ('/product-category/immunity-wellness',                    '/shop?category=immunity'),
  ('/product-category/respiratory-health',                   '/shop?category=cough-respiratory'),
  ('/product-category/throat-care',                          '/shop?category=cough-respiratory'),
  ('/product-category/pediatric-health',                     '/shop?category=kids'),
  ('/product-category/womens-health',                        '/shop?category=women-s-health'),
  ('/product-category/female-fertility-prenatal-health',     '/shop?category=women-s-health'),
  ('/product-category/female-fertility-reproductive-health', '/shop?category=women-s-health'),
  ('/product-category/reproductive-health',                  '/shop?category=women-s-health'),
  ('/product-category/mens-health',                          '/shop?category=men-s-health'),
  ('/product-category/male-fertility',                       '/shop?category=men-s-health'),
  ('/product-category/male-fertility-cardiovascular-health', '/shop?category=men-s-health'),
  ('/product-category/male-vitality-performance',            '/shop?category=men-s-health'),
  ('/product-category/male-vitality-stamina',                '/shop?category=men-s-health'),
  ('/product-category/anti-inflammatory',                    '/shop?taxon=wellness'),
  ('/product-category/beauty-wellness',                      '/shop?taxon=wellness'),
  ('/product-category/blood-health',                         '/shop?taxon=wellness'),
  ('/product-category/brain-health',                         '/shop?taxon=wellness'),
  ('/product-category/electrolyte-balance',                  '/shop?taxon=wellness'),
  ('/product-category/energy-performance',                   '/shop?taxon=wellness'),
  ('/product-category/general-wellness',                     '/shop?taxon=wellness'),
  ('/product-category/health-weallness',                     '/shop?taxon=wellness'),
  ('/product-category/human-health',                         '/shop?taxon=wellness'),
  ('/product-category/liver-health',                         '/shop?taxon=wellness'),
  ('/product-category/sleep-relaxation',                     '/shop?taxon=wellness'),
  ('/product-category/vitamins-minerals',                    '/shop?taxon=wellness'),
  ('/product-category/tints',                                '/shop?category=lip-cheek-tints'),
  ('/product-category/eyeshadow',                            '/shop?category=eyes'),
  ('/product-category/concealers',                           '/shop?category=face-makeup'),
  ('/product-category/contour-sticks',                       '/shop?category=face-makeup'),
  ('/product-category/foundations',                          '/shop?category=face-makeup'),
  ('/product-category/skin-makeup',                          '/shop?category=face-makeup'),
  ('/product-category/highlighters',                         '/shop?category=highlighters'),
  ('/product-category/brushes',                              '/shop?category=brushes-tools'),
  ('/product-category/moisturizers',                         '/shop?category=moisturizers'),
  ('/product-category/hair-care',                            '/shop?category=hair-care'),
  ('/product-category/skincare',                             '/shop?taxon=skincare'),
  ('/product-category/sunscreen',                            '/shop?taxon=skincare'),
  ('/product-category/combo-packs',                          '/shop?category=combo-packs'),
  ('/product-category/budget-bundles',                       '/shop?category=budget-bundles')
) as m(fp, new_to)
where r.from_path = m.fp;
