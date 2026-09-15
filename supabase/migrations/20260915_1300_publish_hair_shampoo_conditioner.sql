-- Publish the eight imported shampoos and conditioners
-- ===================================================
--
-- WHY NOW. PostHog, 30 days to 15 Sep 2026: /blog/best-shampoo-in-pakistan is
-- the single biggest entry point to the store — 216 visitors, 302 views, ahead
-- of the homepage and every product page, roughly 13% of all arrivals. The
-- store had ZERO published shampoos. Twenty-nine archived (Hello Hair, on
-- purpose) and sixteen in draft. Published Hair Care was five items: two oils,
-- minoxidil, a mask and a hair water.
--
-- So the largest stream of people entering the store arrived asking which
-- shampoo to buy and found nothing to buy. This closes that.
--
-- WHAT IS PUBLISHED. Only the eight shampoos and conditioners, by explicit
-- slug. Deliberately NOT included:
--
--   * Olaplex No.3 and The Ordinary Multi-Peptide serum — drafted in the same
--     batch and ready, but neither is a shampoo or a conditioner, and the
--     owner asked for those two categories.
--   * The six "Set and Touch" shampoo drafts — cheap local lines, excluded by
--     the imported-only merchandising directive in AGENTS.md (14 Sep 2026).
--     They stay in Draft; publishing them here would quietly reverse a
--     decision the owner already made.
--
-- TWO THINGS THE OWNER MUST STILL CHECK, both stated when this was applied:
--
--   1. Prices are UNCONFIRMED. They are extrapolated from the store's own
--      per-brand bands (see docs/HAIR-CATALOGUE-DRAFTS-2026-09-14.md), not
--      from supplier cost or a surveyed market price. On cash on delivery a
--      wrong price is either lost margin or a cancelled order.
--   2. stock_mode is 'external', so these never display as sold out and can
--      always be ordered. If the stock is not actually held, an order arrives
--      that cannot be fulfilled — which feeds the 32% COD cancellation rate.
--
-- Neither is a reason to hold the catalogue gap open, and both are one edit to
-- fix, but they are why this migration says so rather than assuming.
--
-- Images are still NULL. The storefront falls back to a branded monogram tile
-- (ProductImage → monogramGradient), so the pages render cleanly rather than
-- broken; see docs/PRODUCT-IMAGES.md for how to source the real photographs.
-- A monogram tile converts worse than a photograph and better than an empty
-- shelf.

update public.products
set status = 'published',
    updated_at = now()
where status = 'draft'
  and slug in (
    'cerave-anti-dandruff-hydrating-shampoo',
    'cerave-anti-dandruff-hydrating-conditioner',
    'la-roche-posay-kerium-ds-anti-dandruff-shampoo',
    'ogx-argan-oil-of-morocco-shampoo',
    'ogx-argan-oil-of-morocco-conditioner',
    'ogx-biotin-collagen-shampoo',
    'ogx-biotin-collagen-conditioner',
    'ogx-tea-tree-mint-shampoo'
  );
