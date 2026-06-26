-- ============================================================================
-- Let doctors attach a photo when they apply (uploaded directly, not a URL).
-- The uploaded image's public URL is stored here and carried onto the
-- content_reviewers profile on approval.
-- ============================================================================

alter table public.reviewer_applications
  add column if not exists photo_url text;
