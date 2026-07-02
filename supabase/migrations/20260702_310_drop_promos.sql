-- ============================================================================
-- Retire the promos feature end-to-end (owner decision, 2026-07-02).
--
-- The audience-targeted promos table (migration 062) was never used — zero
-- rows were ever authored in production — and the owner has also retired the
-- settings-driven promo strip it superseded. The storefront keeps exactly one
-- banner: the announcement bar (announcement_* settings). This migration
-- removes the table and every residue of both systems:
--   * the promos table itself (drops its policies/indexes with it),
--   * the legacy promo_* strip settings (unset in production anyway),
--   * the promo_banner feature flag (seeded in 060, no longer consumed),
--   * the retired 'promos' permission from role and staff grants (the key no
--     longer exists in lib/permissions.ts, so the Team editor would otherwise
--     show unknown-permission residue).
-- ============================================================================

drop table if exists public.promos;

delete from public.site_settings
where key in (
  'promo_active', 'promo_label', 'promo_headline', 'promo_subline',
  'promo_cta_text', 'promo_cta_url', 'promo_bg_color', 'promo_text_color',
  'promo_end_date'
);

delete from public.feature_flags where key = 'promo_banner';

update public.roles
  set permissions = array_remove(permissions, 'promos')
  where 'promos' = any(permissions);

update public.staff_members
  set permissions = array_remove(permissions, 'promos')
  where 'promos' = any(permissions);
