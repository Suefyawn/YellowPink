-- OGX discontinued the Tea Tree Mint shampoo (it sits on ogxbeauty.com's own
-- discontinued page, June 2026). Retailers are selling through remaining
-- stock, so it is orderable today and not restockable tomorrow, which is the
-- worst shape for a COD store: an order arrives that cannot be filled again.
-- It is also the only published product in the catalogue with no image, for
-- the same reason -- there is no current packshot because there is no current
-- product.
--
-- It was drafted once in 20260915_1500 and returned to published by the
-- owner's bulk publish of ten hair products at 07:49 on 15 Sep, which looks
-- like a bulk action rather than a decision about this SKU. Owner confirmed
-- the unpublish on 15 Sep.
--
-- Nothing links to it: no blog post references the slug (the one sentence in
-- /blog/best-shampoo-in-pakistan that did was rewritten by 20260915_1500, and
-- its replacement -- "We do not stock a clarifying shampoo for oily scalps at
-- the moment" -- becomes true again with this change), and it has no
-- collection membership.
update public.products
set status = 'draft', updated_at = now()
where slug = 'ogx-tea-tree-mint-shampoo';
