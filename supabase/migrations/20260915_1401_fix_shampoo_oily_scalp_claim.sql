-- best-shampoo-in-pakistan, follow-up to 20260915_1400.
--
-- One more unlinked mention in the oily-scalp section carried the same false
-- price claim. An oily scalp with flakes wants a dandruff active rather than a
-- clarifying wash, and the honest answer is again that the cheapest way to get
-- one is a brand we do not sell.
update public.blog_posts set body = replace(body,
  'If the greasy scalp comes with flakes, Hello Hair Classic Clean does the same clarifying job with a dandruff active in it, for less than half the price.',
  'If the greasy scalp comes with flakes, you need a dandruff active rather than a clarifying wash, and Head &amp; Shoulders is the cheapest way to get one. The clarifying bottle we stock is <a class="blog-product-link" href="/product/ogx-tea-tree-mint-shampoo">OGX Hydrating + Tea Tree Mint</a> ([[price:ogx-tea-tree-mint-shampoo]]), though tea tree is not a substitute for zinc pyrithione once dandruff is properly established.'),
  updated_at = now()
where slug = 'best-shampoo-in-pakistan';
