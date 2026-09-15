-- Dead product links, part 1: best-shampoo-in-pakistan
-- ====================================================
--
-- Archiving a product does not touch the articles that recommend it, so every
-- blog link to an archived product became a hard 404. A scan found 23 such
-- links across 21 posts, from three archived products.
--
-- This file fixes the worst one. /blog/best-shampoo-in-pakistan is the single
-- biggest entry point to the store (216 visitors, 302 views in 30 days, ahead
-- of the home page), and it recommended two Hello Hair anti-dandruff shampoos
-- that were archived on 14 Sep. Both 404. That is the quickback mechanism
-- Clarity is measuring at 27.8% of sessions: arrive from an assistant, click
-- the recommended product, hit a 404, go back.
--
-- WHY THIS IS A REWRITE AND NOT A LINK SWAP. Hello Hair was PKR 350. The
-- replacements now published are CeraVe at 6,500 and La Roche-Posay at 6,900,
-- which is roughly 19x. The article called Hello Hair "the best-value dandruff
-- shampoo we stock" and said it used "the same active, ZPT, at less than half
-- the price" of Head & Shoulders. CeraVe is eight times Head & Shoulders.
-- Repointing the URLs alone would have left the store publishing false price
-- claims, which is worse than the 404 it fixes.
--
-- So the dandruff passages are rewritten to say what is now true: we stock the
-- dermatologist-grade options, not a budget one, and the article sends a
-- first-time ZPT buyer to Head & Shoulders rather than pretending otherwise.
-- Recommending a competitor we do not sell is the honest answer when the
-- alternative is claiming a 6,500 bottle is the budget pick.
--
-- The two Hello Hair rows come OUT of the price-comparison table rather than
-- being swapped in place: that table is sorted by price and the new products
-- belong at the bottom, not between the Rs 405 and Rs 679 rows.

update public.blog_posts set body =
  -- 1. The "shop the picks" list at the top.
  replace(
  replace(
  -- 2. Remove both Hello Hair rows from the price table.
  replace(
  replace(
  -- 3. Re-add the two we now stock, in price order, after the last row.
  replace(
  -- 4. The claim about the size of the price gap, which the new range breaks.
  replace(
  -- 5. The dandruff recommendation itself.
  replace(
  -- 6. The FAQ line naming a budget pick.
  replace(
  -- 7. The closing call to action.
  replace(body,
    'start with the <a class="blog-product-link" href="/product/hello-hair-classic-clean-anti-dandruff-shampoo-deep-cleansing-dandruff-protection">Hello Hair Classic Clean Anti-Dandruff Shampoo</a>',
    'start with the <a class="blog-product-link" href="/product/cerave-anti-dandruff-hydrating-shampoo">CeraVe Anti-Dandruff Hydrating Shampoo</a>'),

    'For dandruff on a budget, Hello Hair Classic Clean ([[price:hello-hair-classic-clean-anti-dandruff-shampoo-deep-cleansing-dandruff-protection]]).',
    'For dandruff on a budget, Head &amp; Shoulders Classic Clean. For a dry or sensitive scalp, <a class="blog-product-link" href="/product/cerave-anti-dandruff-hydrating-shampoo">CeraVe Anti-Dandruff Hydrating Shampoo</a> ([[price:cerave-anti-dandruff-hydrating-shampoo]]).'),

    'Head &amp; Shoulders (Rs 759 to 800) is the familiar option, and Hello Hair Classic Clean ([[price:hello-hair-classic-clean-anti-dandruff-shampoo-deep-cleansing-dandruff-protection]]) uses the same active, ZPT, at less than half the price, which makes it the best-value dandruff shampoo we stock. If your hair also looks dull and rough, Hello Hair Silky Black Anti-Dandruff ([[price:hello-hair-silky-black-anti-dandruff-shampoo-with-black-seed-oil-for-silky-shiny-flake-free-hair]]) pairs the dandruff control with black seed oil for shine.',
    'Head &amp; Shoulders (Rs 759 to 800) is the familiar option and uses ZPT. If you have never tried a ZPT shampoo, start there, because it is a fifth of the price of anything we sell for the job. What we stock is the dermatologist-grade end: <a class="blog-product-link" href="/product/cerave-anti-dandruff-hydrating-shampoo">CeraVe Anti-Dandruff Hydrating Shampoo</a> ([[price:cerave-anti-dandruff-hydrating-shampoo]]) puts the same active in a fragrance-free base with ceramides, which is the one to reach for when the flaking comes with a tight, itchy scalp that ordinary dandruff shampoo leaves worse. For flakes that have not shifted on anything from a supermarket shelf, <a class="blog-product-link" href="/product/la-roche-posay-kerium-ds-anti-dandruff-shampoo">La Roche-Posay Kerium DS</a> ([[price:la-roche-posay-kerium-ds-anti-dandruff-shampoo]]) is the stronger wash.'),

    'First, the gap between a good budget shampoo and a premium one is now more than four times the price, and the premium bottles are usually smaller.',
    'First, the gap between a good budget shampoo and a dermatologist-grade one runs past fifteen times the price, and the expensive bottles are usually the smaller ones.'),

    '<tr><td>CoNatural Anti-Dandruff Shampoo</td><td>Sensitive scalps with flakes</td><td>Rs 2,299</td></tr>',
    '<tr><td>CoNatural Anti-Dandruff Shampoo</td><td>Sensitive scalps with flakes</td><td>Rs 2,299</td></tr><tr><td><a class="blog-product-link" href="/product/cerave-anti-dandruff-hydrating-shampoo">CeraVe Anti-Dandruff Hydrating</a> (236ml)</td><td>Flakes with a dry, itchy scalp</td><td>[[price:cerave-anti-dandruff-hydrating-shampoo]]</td></tr><tr><td><a class="blog-product-link" href="/product/la-roche-posay-kerium-ds-anti-dandruff-shampoo">La Roche-Posay Kerium DS</a> (125ml)</td><td>Stubborn flakes, sensitive scalp</td><td>[[price:la-roche-posay-kerium-ds-anti-dandruff-shampoo]]</td></tr>'),

    '<tr><td><a class="blog-product-link" href="/product/hello-hair-silky-black-anti-dandruff-shampoo-with-black-seed-oil-for-silky-shiny-flake-free-hair">Hello Hair Silky Black Anti-Dandruff</a> (180ml)</td><td>Dandruff with dull, rough hair</td><td>[[price:hello-hair-silky-black-anti-dandruff-shampoo-with-black-seed-oil-for-silky-shiny-flake-free-hair]]</td></tr>',
    ''),

    '<tr><td><a class="blog-product-link" href="/product/hello-hair-classic-clean-anti-dandruff-shampoo-deep-cleansing-dandruff-protection">Hello Hair Classic Clean Anti-Dandruff</a> (180ml)</td><td>Dandruff, oily scalp</td><td>[[price:hello-hair-classic-clean-anti-dandruff-shampoo-deep-cleansing-dandruff-protection]]</td></tr>',
    ''),

    '<li><a class="blog-product-link" href="/product/hello-hair-silky-black-anti-dandruff-shampoo-with-black-seed-oil-for-silky-shiny-flake-free-hair">Hello Hair Silky Black Anti-Dandruff Shampoo</a>, [[price:hello-hair-silky-black-anti-dandruff-shampoo-with-black-seed-oil-for-silky-shiny-flake-free-hair]], anti-dandruff wash with black seed oil for flakes plus dull hair</li>',
    '<li><a class="blog-product-link" href="/product/la-roche-posay-kerium-ds-anti-dandruff-shampoo">La Roche-Posay Kerium DS Anti-Dandruff Intensive Shampoo</a>, [[price:la-roche-posay-kerium-ds-anti-dandruff-shampoo]], for stubborn flakes a supermarket shampoo has not shifted</li>'),

    '<li><a class="blog-product-link" href="/product/hello-hair-classic-clean-anti-dandruff-shampoo-deep-cleansing-dandruff-protection">Hello Hair Classic Clean Anti-Dandruff Shampoo</a>, [[price:hello-hair-classic-clean-anti-dandruff-shampoo-deep-cleansing-dandruff-protection]], active ZPT, the best-value dandruff shampoo we stock</li>',
    '<li><a class="blog-product-link" href="/product/cerave-anti-dandruff-hydrating-shampoo">CeraVe Anti-Dandruff Hydrating Shampoo</a>, [[price:cerave-anti-dandruff-hydrating-shampoo]], zinc pyrithione in a fragrance-free base, for flakes on a dry or itchy scalp</li>'),
  updated_at = now()
where slug = 'best-shampoo-in-pakistan';
