-- Retrofit the shoppable .blog-product-link class onto every plain /product/ and
-- /brand/ inline link across ALL blog posts (the 8 new posts already had it from
-- migration 225). The base .blog-body a rule already makes links visible; this
-- gives product/brand links the stronger pink, bold, shoppable treatment that
-- converts better. Idempotent: links that already carry a class (incl. the
-- blog-cta buttons, which have class= before href) don't match the pattern, so
-- re-running is a no-op.

update blog_posts set body =
  regexp_replace(
    regexp_replace(body, '<a href="/product/', '<a class="blog-product-link" href="/product/', 'g'),
    '<a href="/brand/', '<a class="blog-product-link" href="/brand/', 'g')
where body like '%<a href="/product/%' or body like '%<a href="/brand/%';
