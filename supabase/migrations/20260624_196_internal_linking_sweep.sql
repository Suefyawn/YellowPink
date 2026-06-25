-- Internal-linking polish: push link equity from established skincare posts to
-- the new content cluster with descriptive contextual links + a curated
-- "Related guides" block. Bumps updated_at so sitemap lastmod / Article
-- dateModified refresh. (Applied to prod via MCP; this file is the record.)

update blog_posts set body =
  replace(
    replace(body,
      $f1$Salicylic acid clears inside the pore$f1$,
      $r1$<a href="/blog/salicylic-acid-for-acne-pakistan">Salicylic acid</a> clears inside the pore$r1$),
    $f2$<td>Retinol</td>$f2$,
    $r2$<td><a href="/blog/retinol-beginners-guide-pakistan">Retinol</a></td>$r2$)
  || $g$
<h2 class="wp-block-heading">Related guides</h2>
<ul class="wp-block-list">
<li><a href="/blog/salicylic-acid-for-acne-pakistan">Salicylic acid for acne: the complete guide</a></li>
<li><a href="/blog/retinol-beginners-guide-pakistan">Retinol for beginners: how to start without irritation</a></li>
<li><a href="/blog/skincare-routine-order-pakistan">Skincare routine order: how to layer your products</a></li>
</ul>$g$,
  updated_at = now()
where slug = 'niacinamide-serum-guide-how-to-use-pakistan';

update blog_posts set body = body || $g$
<h2 class="wp-block-heading">Related guides</h2>
<ul class="wp-block-list">
<li><a href="/blog/skincare-routine-order-pakistan">Skincare routine order: how to layer your products</a></li>
<li><a href="/blog/niacinamide-serum-guide-how-to-use-pakistan">Niacinamide serum: the complete guide</a></li>
<li><a href="/blog/korean-skincare-routine-glass-skin-pakistan">Korean skincare routine for glass skin</a></li>
</ul>$g$, updated_at = now()
where slug = 'vitamin-c-serum-benefits-how-to-use-pakistan';

update blog_posts set body = body || $g$
<h2 class="wp-block-heading">Related guides</h2>
<ul class="wp-block-list">
<li><a href="/blog/salicylic-acid-for-acne-pakistan">Salicylic acid for acne: the complete guide</a></li>
<li><a href="/blog/retinol-beginners-guide-pakistan">Retinol for beginners: how to start without irritation</a></li>
<li><a href="/blog/niacinamide-serum-guide-how-to-use-pakistan">Niacinamide serum: the complete guide</a></li>
</ul>$g$, updated_at = now()
where slug = 'how-to-treat-dark-spots-on-face-pakistan';

update blog_posts set body = body || $g$
<h2 class="wp-block-heading">Related guides</h2>
<ul class="wp-block-list">
<li><a href="/blog/retinol-beginners-guide-pakistan">Retinol for beginners: how to start without irritation</a></li>
<li><a href="/blog/vitamin-c-serum-benefits-how-to-use-pakistan">Vitamin C serum: benefits and how to use it</a></li>
<li><a href="/blog/niacinamide-serum-guide-how-to-use-pakistan">Niacinamide serum: the complete guide</a></li>
</ul>$g$, updated_at = now()
where slug = 'how-to-reduce-melanin-in-skin-naturally-pakistan';

update blog_posts set body = body || $g$
<h2 class="wp-block-heading">Related guides</h2>
<ul class="wp-block-list">
<li><a href="/blog/skincare-routine-order-pakistan">Skincare routine order: how to layer your products</a></li>
<li><a href="/blog/korean-skincare-routine-glass-skin-pakistan">Korean skincare routine for glass skin</a></li>
<li><a href="/blog/best-moisturizer-for-oily-skin-pakistan">Best moisturiser for oily skin</a></li>
</ul>$g$, updated_at = now()
where slug = 'best-sunscreen-for-oily-skin-pakistan';

update blog_posts set body = body || $g$
<h2 class="wp-block-heading">Related guides</h2>
<ul class="wp-block-list">
<li><a href="/blog/skincare-routine-order-pakistan">Skincare routine order: how to layer your products</a></li>
<li><a href="/blog/korean-skincare-routine-glass-skin-pakistan">Korean skincare routine for glass skin</a></li>
<li><a href="/blog/best-moisturizer-for-oily-skin-pakistan">Best moisturiser for oily skin</a></li>
</ul>$g$, updated_at = now()
where slug = 'hyaluronic-acid-serum-benefits-how-to-use-pakistan';
