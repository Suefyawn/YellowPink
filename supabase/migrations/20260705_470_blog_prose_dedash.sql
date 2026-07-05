-- ============================================================================
-- Prose cleanup: strip em/en dashes from blog copy.
--
-- The em dash (—) reads as an "AI-written" tell, and a handful of recently
-- authored posts leaned on it. This normalises blog prose to ordinary
-- punctuation: numeric ranges (e.g. "10—20 min") become hyphens, every other
-- dash becomes a comma (safe for the appositives/parentheticals/list-intros
-- these were). Applied to `body` and `excerpt` for any post that still has one.
--
-- Idempotent: re-running finds no dashes to replace. Forward-fix — the original
-- insert migrations are left untouched (append-only), and this UPDATE runs
-- after them so a from-scratch rebuild ends up in the same clean state as prod.
-- ============================================================================

update blog_posts set
  body = regexp_replace(
           regexp_replace(
             regexp_replace(body, '([0-9])\s*[—–]\s*([0-9])', '\1-\2', 'g'),
           ' [—–] ', ', ', 'g'),
         '\s*[—–]\s*', ', ', 'g'),
  excerpt = regexp_replace(
             regexp_replace(
               regexp_replace(coalesce(excerpt,''), '([0-9])\s*[—–]\s*([0-9])', '\1-\2', 'g'),
             ' [—–] ', ', ', 'g'),
           '\s*[—–]\s*', ', ', 'g')
where body ~ '[—–]' or excerpt ~ '[—–]';
