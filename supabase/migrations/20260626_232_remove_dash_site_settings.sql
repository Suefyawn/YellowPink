-- Migration 229 stripped the em/en-dash "AI tell" from products, blog_posts,
-- brands and pages, but missed site_settings — so the announcement bar
-- ("Free delivery … PKR 5,000 — COD Nationwide") and the homepage hero subline
-- still rendered the dash on every page. Replace the spaced dash with a comma.
update site_settings
set value = regexp_replace(value, '\s+[—–]\s+', ', ', 'g')
where key in ('announcement_text', 'hero_subline')
  and value ~ '[—–]';
