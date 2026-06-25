-- ============================================================================
-- Redirect old WordPress page URLs that Google still has indexed but which now
-- 404.
--
-- The WP importer brought several pages over as DRAFTS because they collide
-- with first-class routes the new storefront owns (home, shop, blog, cart,
-- checkout, my-account) or no longer exist (reviews-from-verified-buyers).
-- The /page/[slug] route only serves PUBLISHED rows, so each of these 404s —
-- e.g. https://www.yellowpink.pk/page/home (the old WP front page, wp_page_id 8).
--
-- Middleware skips the redirects table for owned /page/* paths, so these are
-- now honoured at the route's 404 boundary via lib/redirects.redirectIfMapped
-- (308 permanent). Point each at its live equivalent so the indexed URL passes
-- equity instead of dead-ending.
-- ============================================================================

insert into public.redirects (from_path, to_path, status_code, source) values
  ('/page/home',                         '/',         301, 'admin'),
  ('/page/blog',                         '/blog',     301, 'admin'),
  ('/page/shop',                         '/shop',     301, 'admin'),
  ('/page/cart',                         '/cart',     301, 'admin'),
  ('/page/checkout',                     '/checkout', 301, 'admin'),
  ('/page/my-account',                   '/account',  301, 'admin'),
  ('/page/reviews-from-verified-buyers', '/shop',     301, 'admin')
on conflict (from_path) do nothing;
