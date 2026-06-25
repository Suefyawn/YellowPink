-- ============================================================================
-- Point the 35 gap draft scaffolds at their product images. Images were sourced
-- from the brands' own sites (mostly Shopify CDNs) and self-hosted under
-- /public/catalog/<slug>.<ext> — the same convention the live catalogue uses,
-- so they deploy with the repo and can't break if a brand changes its site.
-- Drafts stay hidden until published. Idempotent UPDATE…FROM keyed by slug.
-- ============================================================================

update products p set image_url = v.url
from (values
  ('vitamin-b12',            'https://www.yellowpink.pk/catalog/vitamin-b12.png'),
  ('creatine-monohydrate',   'https://www.yellowpink.pk/catalog/creatine-monohydrate.png'),
  ('melatonin',              'https://www.yellowpink.pk/catalog/melatonin.png'),
  ('apple-cider-vinegar',    'https://www.yellowpink.pk/catalog/apple-cider-vinegar.png'),
  ('cod-liver-oil',          'https://www.yellowpink.pk/catalog/cod-liver-oil.jpg'),
  ('zinc-supplement',        'https://www.yellowpink.pk/catalog/zinc-supplement.png'),
  ('ginseng',                'https://www.yellowpink.pk/catalog/ginseng.png'),
  ('ginkgo-biloba',          'https://www.yellowpink.pk/catalog/ginkgo-biloba.png'),
  ('vitamin-e',              'https://www.yellowpink.pk/catalog/vitamin-e.png'),
  ('probiotics',             'https://www.yellowpink.pk/catalog/probiotics.png'),
  ('coq10',                  'https://www.yellowpink.pk/catalog/coq10.png'),
  ('selenium',               'https://www.yellowpink.pk/catalog/selenium.png'),
  ('evening-primrose-oil',   'https://www.yellowpink.pk/catalog/evening-primrose-oil.png'),
  ('vitamin-b-complex',      'https://www.yellowpink.pk/catalog/vitamin-b-complex.png'),
  ('sea-moss',               'https://www.yellowpink.pk/catalog/sea-moss.webp'),
  ('whey-protein',           'https://www.yellowpink.pk/catalog/whey-protein.png'),
  ('psyllium-husk',          'https://www.yellowpink.pk/catalog/psyllium-husk.jpg'),
  ('collagen-peptides-powder','https://www.yellowpink.pk/catalog/collagen-peptides-powder.png'),
  ('omega-3-fish-oil',       'https://www.yellowpink.pk/catalog/omega-3-fish-oil.png'),
  ('biotin-10000-mcg',       'https://www.yellowpink.pk/catalog/biotin-10000-mcg.jpg'),
  ('kajal',                  'https://www.yellowpink.pk/catalog/kajal.jpg'),
  ('rosemary-oil',           'https://www.yellowpink.pk/catalog/rosemary-oil.jpg'),
  ('castor-oil',             'https://www.yellowpink.pk/catalog/castor-oil.jpg'),
  ('salicylic-acid-serum',   'https://www.yellowpink.pk/catalog/salicylic-acid-serum.png'),
  ('retinol-serum',          'https://www.yellowpink.pk/catalog/retinol-serum.png'),
  ('hyaluronic-acid-serum',  'https://www.yellowpink.pk/catalog/hyaluronic-acid-serum.jpg'),
  ('lip-balm',               'https://www.yellowpink.pk/catalog/lip-balm.jpg'),
  ('hair-growth-oil',        'https://www.yellowpink.pk/catalog/hair-growth-oil.jpg'),
  ('minoxidil',              'https://www.yellowpink.pk/catalog/minoxidil.jpg'),
  ('eyeliner',               'https://www.yellowpink.pk/catalog/eyeliner.jpg'),
  ('micellar-water',         'https://www.yellowpink.pk/catalog/micellar-water.jpg'),
  ('mascara',                'https://www.yellowpink.pk/catalog/mascara.jpg'),
  ('lip-liner',              'https://www.yellowpink.pk/catalog/lip-liner.jpg'),
  ('setting-spray',          'https://www.yellowpink.pk/catalog/setting-spray.png'),
  ('sheet-mask',             'https://www.yellowpink.pk/catalog/sheet-mask.jpg')
) as v(slug, url)
where p.slug = v.slug and p.status = 'draft';
