-- Put hair on the homepage. Owner's pick, 15 Sep.
--
-- Until now every featured product was skincare (Anua azelaic, Beauty of
-- Joseon Relief Sun, Effaclar Duo+M, Cicaplast B5), so a 14-product hair shelf
-- had no route onto the home page at all. These three sit against the
-- strongest hair demand the store can actually serve: anti-dandruff (roughly
-- 8,260 searches a month) and the argan oil pair for dry and coloured hair.
--
-- Checked before flipping, because a Featured pin can silently do nothing:
--
--   * getFeatured() filters on PURCHASABLE, which is
--     'stock.gt.0,track_inventory.is.false,continue_selling_when_out.is.true'
--     as an OR. All three are stock_mode 'external' with track_inventory
--     false, so they satisfy the second clause and appear despite a zero
--     count. A pin on an 'own'-stock product at zero would have been invisible.
--   * The Featured rail renders 4 tiles via dailyRotation over the whole
--     flagged pool, not the top 4 by score. With 7 flagged products all seven
--     rotate through, so these are not buried behind the four skincare pins
--     that already carry real popularity scores.
--   * The admin health card's sold-out nag skips track_inventory = false, so
--     these will not raise a false "sold out but still pinned" warning.
--
-- The card's zero-demand advisory WILL list them, which is correct and worth
-- leaving: they have no views, carts or sales yet, and that is the honest
-- state of a product featured on judgement rather than on evidence.
--
-- is_bestseller is deliberately NOT set. These have sold zero units, and that
-- badge is a claim to the shopper rather than a merchandising slot.
update public.products
set is_featured = true, updated_at = now()
where slug in (
  'cerave-anti-dandruff-hydrating-shampoo',
  'ogx-argan-oil-of-morocco-shampoo',
  'ogx-argan-oil-of-morocco-conditioner'
);
