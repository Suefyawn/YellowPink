-- Match NB Sons' own retail prices (nbsons.com) where we were charging MORE
-- than the brand owner. Compared all 57 NB Sons SKUs against
-- nbsons.com/products.json; 45 already matched. We lower the two we were
-- overpricing:
--   argivital-sachet  4100 -> 3500  (NB Sons 3500, strikethrough 6500)
--   trimo-m           2499 -> 1790
-- Deliberately NOT matched (owner's decision to stay cheaper / variant call):
--   puratin, stevoice  — we sell below NB Sons; keep undercutting them.
--   ultrapin           — ours is the 2-pack (595 = NB Sons' double-pack), not
--                        the 350 single.
update products set price = 3500, original_price = 6500 where slug = 'argivital-sachet';
update products set price = 1790                          where slug = 'trimo-m';
