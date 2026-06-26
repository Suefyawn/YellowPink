-- ============================================================================
-- Consolidate the legacy store-wide medical reviewer onto the Medical Review
-- Board so there's a single source of truth.
--
-- The old Settings → Integrations "Medical reviewer" fields (site_settings
-- medical_reviewer_*) were a name-only fallback byline. The Review Board
-- (content_reviewers) is the real system. Migrate the legacy reviewer in as the
-- DEFAULT board member — but only if the board is still empty — so health-post
-- bylines don't disappear, then retire the legacy keys.
-- ============================================================================

insert into public.content_reviewers (slug, name, credentials, active, is_default)
select
  -- "Dr. Areej Saeed" → "areej-saeed" (drop honorific, slugify)
  trim(both '-' from regexp_replace(
    lower(regexp_replace(s.name_val, '^\s*(dr|prof|mr|ms|mrs)\.?\s+', '', 'i')),
    '[^a-z0-9]+', '-', 'g')),
  s.name_val,
  s.cred_val,
  true,
  true
from (
  select
    (select nullif(trim(value), '') from public.site_settings where key = 'medical_reviewer_name') as name_val,
    (select nullif(trim(value), '') from public.site_settings where key = 'medical_reviewer_credentials') as cred_val
) s
where s.name_val is not null
  and not exists (select 1 from public.content_reviewers)
on conflict (slug) do nothing;

-- Retire the legacy keys now that the board owns reviewers.
delete from public.site_settings
where key in ('medical_reviewer_name', 'medical_reviewer_credentials', 'medical_reviewer_url');
