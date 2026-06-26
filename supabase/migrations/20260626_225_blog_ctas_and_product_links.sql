-- The 8 SEO posts added this session used plain <a> tags for product/brand
-- links and had no transactional CTA, so they rendered as unstyled text with no
-- obvious shop action. Two fixes:
--   1. Tag every inline /product/ and /brand/ link with class="blog-product-link"
--      so it renders as a pink, shoppable link (the class the blog CSS expects).
--   2. Append a prominent class="blog-cta" shop button to each post (the house
--      pattern used by 35 existing posts).
-- (A base .blog-body a CSS rule shipped alongside this makes ALL inline links —
-- internal cross-links and external citations — read as clickable too.)
-- Guard: skip posts that already have a CTA, so re-running is a no-op.

update blog_posts p set body =
  regexp_replace(
    regexp_replace(p.body, '<a href="/product/', '<a class="blog-product-link" href="/product/', 'g'),
    '<a href="/brand/', '<a class="blog-product-link" href="/brand/', 'g')
  || v.cta
from (values
  ('vitamin-d-deficiency-pakistan',              '<a class="blog-cta" href="/product/vit-kd">Shop Vit KD — Vitamin D3 + K2 →</a>'),
  ('azelaic-acid-benefits-how-to-use-pakistan',  '<a class="blog-cta" href="/product/anua-azelaic-10-hyaluron-redness-soothing-serum">Shop Anua Azelaic Acid 10% Serum →</a>'),
  ('magnesium-glycinate-benefits-pakistan',      '<a class="blog-cta" href="/product/calco-fit">Shop Calco Fit Magnesium Glycinate →</a>'),
  ('folic-acid-tablets-benefits-dosage-pakistan','<a class="blog-cta" href="/product/fol-chew">Shop FOL Chew Folate →</a>'),
  ('glycolic-acid-benefits-how-to-use-pakistan', '<a class="blog-cta" href="/product/the-ordinary-7-glycolic-acid-toner">Shop The Ordinary Glycolic Acid Toner →</a>'),
  ('cerave-products-guide-pakistan',             '<a class="blog-cta" href="/brand/cerave">Shop all CeraVe →</a>'),
  ('melatonin-for-sleep-pakistan',               '<a class="blog-cta" href="/product/puratin">Shop Puratin Melatonin →</a>'),
  ('calcium-tablets-benefits-pakistan',          '<a class="blog-cta" href="/product/calin-g">Shop CALIN-G Calcium + D3 →</a>')
) as v(slug, cta)
where p.slug = v.slug
  and p.body not like '%blog-cta%';
