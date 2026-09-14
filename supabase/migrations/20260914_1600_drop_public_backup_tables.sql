-- Drop the 4 Sep 2026 backup tables.
--
-- They were created as a safety net around that day's content fact-check and
-- were never cleaned up. Unlike every other table in this schema they had RLS
-- DISABLED, which meant the anon key — the one shipped in the browser bundle,
-- readable by anyone who views source — could both READ and WRITE them:
--
--   products_backup_20260904          62 rows
--   products_backup_all_20260904     609 rows
--   blog_posts_backup_20260904       261 rows
--   brands_backup_20260904            60 rows
--   collections_backup_20260904       14 rows
--   pages_backup_20260904             15 rows
--
-- Checked before dropping rather than after: every row in every backup still
-- exists in its live table, with exactly one exception. products_backup_all
-- holds `energy-boost` (d53916a1-e90f-4ed7-8786-22e67f77db99), which is not in
-- public.products because it was deliberately deleted on 4 Sep — a duplicate
-- listing for a product the owner confirmed twice was not real. That row is
-- preserved in full, with a restore note, at
-- docs/removed-products/energy-boost.json, so dropping these tables loses
-- nothing that is not recorded elsewhere.
--
-- Enabling RLS with no policies would also have closed the hole, but these are
-- stale copies of live data; keeping a second, unmaintained copy of the whole
-- catalogue around is its own liability.

drop table if exists public.products_backup_20260904;
drop table if exists public.products_backup_all_20260904;
drop table if exists public.blog_posts_backup_20260904;
drop table if exists public.brands_backup_20260904;
drop table if exists public.collections_backup_20260904;
drop table if exists public.pages_backup_20260904;
