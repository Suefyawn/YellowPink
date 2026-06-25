-- Blog cannibalization cleanup. Two sets of duplicate-content posts were
-- competing for the same queries:
--   • Vit KD — THREE byte-identical posts (same md5 body). Keep the cleanest
--     canonical slug, delete the other two.
--   • Increase sperm count — two distinct articles for one intent. Keep the
--     comprehensive 16k-word guide; move the on-brand hero from the thinner
--     post onto it before deleting the thinner one.
-- 308 permanent redirects for all removed slugs are in next.config.ts so no
-- link/crawl equity is lost.

update blog_posts
set image_url = '/blog-heroes/increase-sperm-count-pakistan.webp'
where slug = 'increase-sperm-count-naturally-pakistan-guide';

delete from blog_posts
where slug in (
  'vit-kd-vitamin-d3-10000-iu-k2-pakistan-2',
  'vit-kd-vitamin-d3-k2-bone-heart-health-pakistan',
  'how-to-increase-sperm-count-naturally-pakistan'
);
