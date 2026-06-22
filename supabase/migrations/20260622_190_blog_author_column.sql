-- Per-post author byline + Article schema author.
-- Adds an optional `author` column to blog_posts. Existing posts are
-- backfilled with the editorial-team name so every post renders a byline;
-- admins can set a named author per post in the BlogForm for stronger
-- E-E-A-T on health/beauty content (the articleLd() generator emits a
-- Person author when the name is an individual, Organization otherwise).
alter table blog_posts add column if not exists author text;

update blog_posts
set author = 'Yellow Pink Editorial Team'
where author is null or btrim(author) = '';
