-- Dead product links, part 2: the other two Hello Hair articles.
--
-- Same cause as 20260915_1400: archiving Hello Hair on 14 Sep left every
-- article that recommended it pointing at a 404. Same treatment, and again a
-- rewrite rather than a swap, because Hello Hair was PKR 350 and the
-- replacements are 6,500 and 6,900.
--
-- A pre-existing defect surfaced in the dandruff article and is fixed here as
-- a side effect: THREE different product names ("Classic Clean",
-- "Refreshing Menthol", "Dandruff Control") all linked to the same single URL.
-- Only one of those products ever existed at that slug.
update public.blog_posts set body =
  replace(
  replace(
  replace(
  replace(body,
    '<a class="blog-cta" href="/product/hello-hair-classic-clean-anti-dandruff-shampoo-deep-cleansing-dandruff-protection">Shop Hello Hair Classic Clean Anti-Dandruff Shampoo →</a>',
    '<a class="blog-cta" href="/product/cerave-anti-dandruff-hydrating-shampoo">Shop CeraVe Anti-Dandruff Hydrating Shampoo →</a>'),
    'For an all in one option covering shampoo and conditioner needs, the <a class="blog-product-link" href="/product/hello-hair-classic-clean-anti-dandruff-shampoo-deep-cleansing-dandruff-protection">Hello Hair - Dandruff Control Shampoo</a> clears flakes while leaving hair manageable, useful if you want to simplify your routine.',
    'To cover shampoo and conditioner in one routine, the <a class="blog-product-link" href="/product/cerave-anti-dandruff-hydrating-shampoo">CeraVe Anti-Dandruff Hydrating Shampoo</a> and its matching <a class="blog-product-link" href="/product/cerave-anti-dandruff-hydrating-conditioner">conditioner</a> are built to be used together: the shampoo on the scalp, the conditioner on the lengths only.'),
    'If your scalp feels hot or oily in Pakistan''s summer humidity, a cooling formula such as the <a class="blog-product-link" href="/product/hello-hair-classic-clean-anti-dandruff-shampoo-deep-cleansing-dandruff-protection">Hello Hair Refreshing Menthol Anti-Dandruff Shampoo</a> can feel more comfortable day to day. If you prefer a gentler, traditional formula, the <a class="blog-product-link" href="/product/hello-hair-silky-black-anti-dandruff-shampoo-with-black-seed-oil-for-silky-shiny-flake-free-hair">Hello Hair Silky Black Anti-Dandruff Shampoo with Black Seed Oil</a> pairs dandruff control with added shine and softness.',
    'If your scalp feels hot or oily in Pakistan''s summer humidity, you want a wash that clears flakes without adding weight. <a class="blog-product-link" href="/product/cerave-anti-dandruff-hydrating-shampoo">CeraVe Anti-Dandruff Hydrating Shampoo</a> is fragrance-free and light enough to use often in heat. If the flaking is heavy and has not shifted on an ordinary anti-dandruff shampoo, <a class="blog-product-link" href="/product/la-roche-posay-kerium-ds-anti-dandruff-shampoo">La Roche-Posay Kerium DS</a> uses micro-exfoliating LHA with salicylic acid and is meant as a four-week course, twice a week, rather than a shampoo you stay on.'),
    'For a dependable everyday option, the <a class="blog-product-link" href="/product/hello-hair-classic-clean-anti-dandruff-shampoo-deep-cleansing-dandruff-protection">Hello Hair Classic Clean Anti-Dandruff Shampoo</a> combines deep cleansing with dandruff protection and suits most scalp types.',
    'For a dependable everyday option, the <a class="blog-product-link" href="/product/cerave-anti-dandruff-hydrating-shampoo">CeraVe Anti-Dandruff Hydrating Shampoo</a> puts 1% pyrithione zinc alongside ceramides and niacinamide, so it clears flakes without leaving the scalp tight.'),
  updated_at = now()
where slug = 'dandruff-treatment-shampoos-home-remedies-pakistan';

update public.blog_posts set body =
  replace(
  replace(body,
    'keep an anti-dandruff shampoo such as <a class="blog-product-link" href="/product/hello-hair-classic-clean-anti-dandruff-shampoo-deep-cleansing-dandruff-protection">Hello Hair Classic Clean</a> for the scalp',
    'keep an anti-dandruff shampoo such as <a class="blog-product-link" href="/product/cerave-anti-dandruff-hydrating-shampoo">CeraVe Anti-Dandruff Hydrating</a> for the scalp'),
    '<li><a class="blog-product-link" href="/product/hello-hair-classic-clean-anti-dandruff-shampoo-deep-cleansing-dandruff-protection">Hello Hair Classic Clean Anti-Dandruff Shampoo 180ml</a>, [[price:hello-hair-classic-clean-anti-dandruff-shampoo-deep-cleansing-dandruff-protection]], for a flaky scalp, with conditioner kept to the lengths</li>',
    '<li><a class="blog-product-link" href="/product/cerave-anti-dandruff-hydrating-shampoo">CeraVe Anti-Dandruff Hydrating Shampoo 355ml</a>, [[price:cerave-anti-dandruff-hydrating-shampoo]], for a flaky scalp, with conditioner kept to the lengths</li>'),
  updated_at = now()
where slug = 'hair-conditioner-guide-pakistan';
