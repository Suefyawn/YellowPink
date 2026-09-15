-- Make the two articles that rank for stock we do not carry answer the query
-- they were written for.
--
-- /blog/best-facial-kit-in-pakistan (79 real sessions in 90 days, 8.9% reach a
-- product page) and /blog/bb-cream-guide-price-pakistan (28 sessions, 3.6%)
-- against 20-26% for the brand guides. Neither has a broken link and both are
-- good editorial; every product they point at is published and imaged. They
-- lose the reader for a different reason: both rank for a category the store
-- deliberately does not stock (the only BB creams and facial kits in the
-- catalogue are Golden Pearl drafts at Rs 255-3,613, which the 14 Sep
-- directive keeps unpublished), so each article answers the search fully and
-- then hands the reader to somebody else to buy from.
--
-- Nothing here softens what the articles say. Their honesty is why they rank
-- and it is the house voice. The changes are the three places where an honest
-- article was still losing a reader who wanted to buy:
--
--   1. In best-facial-kit, the "Building a better facial from single products"
--      table is the buying table, and five of its eight rows were plain text.
--      A reader scanning prices could not click most of them. Now linked.
--   2. Both picks blocks opened on what the store does not sell. They now open
--      on what the reader gets and keep the "we do not stock it" caveat, moved
--      to where it informs rather than deters.
--   3. best-facial-kit had no closing call to action at all, and the line that
--      makes its whole argument ("put the money into a good cleanser, a mild
--      exfoliant, a moisturiser and a sunscreen") linked to nothing.
--
-- The facial picks also gain the Beauty of Joseon wash-off mask above the
-- Garnier sheet mask: a 150ml tub covers many sittings where a sheet covers
-- one, and it is an imported line from an existing vendor.
--
-- No price claim is made that the catalogue does not support. The assembled
-- set is more expensive up front than a Rs 2,000 kit and the copy says so.

-- ── best-facial-kit-in-pakistan ─────────────────────────────────────────────
UPDATE blog_posts SET body = replace(body,
'<div class="blog-picks"><p><strong>Shop the picks in this guide</strong></p><ul>',
'<div class="blog-picks"><p><strong>Shop the picks in this guide</strong></p>
<p>We do not sell a boxed facial kit. This is the same facial in single products, which is what the second half of this guide argues for: you buy each step once, replace them one at a time as they run out, and there is no bleach sachet in the set. It costs more up front than a Rs 2,000 kit and lasts a good deal longer.</p>
<ul>')
WHERE slug = 'best-facial-kit-in-pakistan';

UPDATE blog_posts SET body = replace(body,
'<li><a class="blog-product-link" href="/product/sheet-mask">Garnier Hydra Bomb Tissue Mask</a>, [[price:sheet-mask]], the mask step for dry skin, one sitting per sheet</li>',
'<li><a class="blog-product-link" href="/product/beauty-of-joseon-ground-rice-honey-glow-mask">Beauty of Joseon Ground Rice &amp; Honey Glow Mask 150ml</a>, [[price:beauty-of-joseon-ground-rice-honey-glow-mask]], the mask step, and a 150ml tub covers a run of sittings rather than one</li>
<li><a class="blog-product-link" href="/product/sheet-mask">Garnier Hydra Bomb Tissue Mask</a>, [[price:sheet-mask]], the cheapest way to try the mask step, one sitting per sheet</li>')
WHERE slug = 'best-facial-kit-in-pakistan';

-- The buying table: five of eight product names were not links.
UPDATE blog_posts SET body = replace(body,
'<td>NB Sons Hydrating Face Wash</td>',
'<td><a class="blog-product-link" href="/product/hydrating-face-wash">NB Sons Hydrating Face Wash</a></td>')
WHERE slug = 'best-facial-kit-in-pakistan';

UPDATE blog_posts SET body = replace(body,
'<td>St. Ives Gentle Smoothing Rose &amp; Aloe Face Scrub 170g</td>',
'<td><a class="blog-product-link" href="/product/st-ives-rose-aloe-face-scrub">St. Ives Gentle Smoothing Rose &amp; Aloe Face Scrub 170g</a></td>')
WHERE slug = 'best-facial-kit-in-pakistan';

UPDATE blog_posts SET body = replace(body,
'<td>Pixi Glow Tonic (5% Glycolic Acid Toner)</td>',
'<td><a class="blog-product-link" href="/product/pixi-glow-tonic-5-glycolic-acid-toner">Pixi Glow Tonic (5% Glycolic Acid Toner)</a></td>')
WHERE slug = 'best-facial-kit-in-pakistan';

UPDATE blog_posts SET body = replace(body,
'<td>Garnier Hydra Bomb Tissue Mask</td>',
'<td><a class="blog-product-link" href="/product/sheet-mask">Garnier Hydra Bomb Tissue Mask</a></td>')
WHERE slug = 'best-facial-kit-in-pakistan';

UPDATE blog_posts SET body = replace(body,
'<td>St. Ives Collagen &amp; Elastin Face Moisturizer 283g</td>',
'<td><a class="blog-product-link" href="/product/st-ives-collagen-face-moisturizer">St. Ives Collagen &amp; Elastin Face Moisturizer 283g</a></td>')
WHERE slug = 'best-facial-kit-in-pakistan';

-- The line carrying the article's actual argument, now clickable.
UPDATE blog_posts SET body = replace(body,
'put the money into a good cleanser, a mild exfoliant you use twice a week, a moisturiser and a sunscreen.',
'put the money into a good <a class="blog-product-link" href="/product/cerave-hydrating-facial-cleanser">cleanser</a>, a <a class="blog-product-link" href="/product/st-ives-rose-aloe-face-scrub">mild exfoliant</a> you use twice a week, a <a class="blog-product-link" href="/product/st-ives-collagen-face-moisturizer">moisturiser</a> and a <a class="blog-product-link" href="/product/beauty-of-joseon-relief-sun-rice-probiotics-spf50">sunscreen</a>.')
WHERE slug = 'best-facial-kit-in-pakistan';

-- It was the only one of the three guides with no closing call to action.
UPDATE blog_posts
SET body = body || E'\n\n<a class="blog-cta" href="/product/beauty-of-joseon-ground-rice-honey-glow-mask">Shop the Beauty of Joseon Ground Rice &amp; Honey Glow Mask &rarr;</a>'
WHERE slug = 'best-facial-kit-in-pakistan'
  AND body NOT LIKE '%blog-cta%';

-- ── bb-cream-guide-price-pakistan ───────────────────────────────────────────
UPDATE blog_posts SET body = replace(body,
'<p>We do not stock BB cream itself. These are the products from this guide that we do carry, and the tinted bases at the top are what most people are actually after when they ask for one. They cost more than a drugstore BB cream, because you are buying a real sunscreen dose along with the tint.</p>',
'<p>The tinted bases at the top are what most people are after when they ask for a BB cream: the same sheer, evened-out finish, with the sun step built into it. We do not stock BB cream itself. These cost more than a drugstore one, and the reason is the sunscreen dose you get in the same layer.</p>')
WHERE slug = 'bb-cream-guide-price-pakistan';

UPDATE blog_posts SET body = replace(body,
'is the one to buy if you want the tint and the sun protection in a single step, and it costs more than any BB cream in the table above for that reason.',
'is the one to buy if you want the tint and the sun protection in a single step. It costs more than any BB cream in the table above, and what the extra buys is the sun protection: a BB cream carrying SPF 15 or SPF 25 delivers very little of that number at the amount anyone actually applies to their face, so you end up buying sunscreen as well.')
WHERE slug = 'bb-cream-guide-price-pakistan';

UPDATE blog_posts SET updated_at = now()
WHERE slug IN ('best-facial-kit-in-pakistan', 'bb-cream-guide-price-pakistan');
