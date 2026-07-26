-- SERP title override for blog posts (Semrush #102: 148 posts render a
-- <title> over 75 chars because the full headline + " | Yellow Pink" suffix
-- always exceeds Google's ~60-char display budget). The H1 keeps the full
-- headline; seo_title only replaces the <title>/OG title when set.
alter table blog_posts add column if not exists seo_title text;
