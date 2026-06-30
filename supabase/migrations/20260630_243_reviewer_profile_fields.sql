-- Richer Medical Review Board profile fields (E-E-A-T depth). All optional;
-- reviewers fill them via the /reviewer portal, admins via /admin/reviewers,
-- and they surface on the public /medical-review-board/[slug] profile + its
-- Person schema (alumniOf, knowsLanguage, affiliation).
alter table content_reviewers
  add column if not exists affiliation       text,   -- current clinic / hospital / practice
  add column if not exists education         text,   -- medical school / training (schema alumniOf)
  add column if not exists experience_years  int,    -- years in practice
  add column if not exists languages         text[] not null default '{}';
