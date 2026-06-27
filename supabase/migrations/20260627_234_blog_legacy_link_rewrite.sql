-- Kill the redirect chains the Semrush audit flagged (issue 33): blog bodies
-- still linked to legacy WP URLs, each of which took 3 hops to resolve
--   yellowpink.pk/product-category/x/  (non-www, 308)
--   → www.yellowpink.pk/product-category/x/  (308)
--   → www.yellowpink.pk/product-category/x   (301)
--   → www.yellowpink.pk/shop?category=x       (200)
-- Point the links straight at the final URL: removes the chains, saves crawl
-- budget, and stops reinforcing the duplicate legacy URLs that were splitting
-- ranking signal with the /blog/ versions.

-- ── Legacy /product-category/* links → canonical /shop targets ───────────────
update blog_posts set body = regexp_replace(body, 'https?://(www\.)?yellowpink\.pk/product-category/womens-health/?',     'https://www.yellowpink.pk/shop?category=women-s-health',   'g') where body ~* 'product-category/womens-health';
update blog_posts set body = regexp_replace(body, 'https?://(www\.)?yellowpink\.pk/product-category/mens-health/?',       'https://www.yellowpink.pk/shop?category=men-s-health',     'g') where body ~* 'product-category/mens-health';
update blog_posts set body = regexp_replace(body, 'https?://(www\.)?yellowpink\.pk/product-category/male-fertility/?',    'https://www.yellowpink.pk/shop?category=men-s-health',     'g') where body ~* 'product-category/male-fertility';
update blog_posts set body = regexp_replace(body, 'https?://(www\.)?yellowpink\.pk/product-category/health-supplements/?','https://www.yellowpink.pk/shop?category=health-supplements','g') where body ~* 'product-category/health-supplements';
update blog_posts set body = regexp_replace(body, 'https?://(www\.)?yellowpink\.pk/product-category/vitamins-minerals/?', 'https://www.yellowpink.pk/shop?taxon=wellness',            'g') where body ~* 'product-category/vitamins-minerals';
update blog_posts set body = regexp_replace(body, 'https?://(www\.)?yellowpink\.pk/product-category/bone-health/?',       'https://www.yellowpink.pk/shop?category=bone-joint',       'g') where body ~* 'product-category/bone-health';

-- ── Legacy root-slug post links → /blog/<slug> (the 4 present in bodies) ──────
update blog_posts set body = regexp_replace(body, 'https?://(www\.)?yellowpink\.pk/argivital-sachet-l-arginine-coq10-lycopene-for-male-health-pakistan/', 'https://www.yellowpink.pk/blog/argivital-sachet-l-arginine-coq10-lycopene-for-male-health-pakistan', 'g') where body ~ 'yellowpink\.pk/argivital-sachet-l-arginine-coq10-lycopene-for-male-health-pakistan/';
update blog_posts set body = regexp_replace(body, 'https?://(www\.)?yellowpink\.pk/myo-inositol-pcos-pakistan-guide/',                                    'https://www.yellowpink.pk/blog/myo-inositol-pcos-pakistan-guide',                                    'g') where body ~ 'yellowpink\.pk/myo-inositol-pcos-pakistan-guide/';
update blog_posts set body = regexp_replace(body, 'https?://(www\.)?yellowpink\.pk/trimo-m-herbal-testosterone-booster-men-pakistan/',                    'https://www.yellowpink.pk/blog/trimo-m-herbal-testosterone-booster-men-pakistan',                    'g') where body ~ 'yellowpink\.pk/trimo-m-herbal-testosterone-booster-men-pakistan/';
update blog_posts set body = regexp_replace(body, 'https?://(www\.)?yellowpink\.pk/x-fit-male-vitality-supplement-pakistan/',                             'https://www.yellowpink.pk/blog/x-fit-male-vitality-supplement-pakistan',                             'g') where body ~ 'yellowpink\.pk/x-fit-male-vitality-supplement-pakistan/';
