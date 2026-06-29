-- Match NB Sons' own retail prices (nbsons.com). Compared all 57 NB Sons SKUs
-- against nbsons.com/products.json; 45 already matched. These 5 differed and
-- are aligned to the brand owner's price:
--   argivital-sachet  4100 -> 3500  (NB Sons 3500, strikethrough 6500)
--   trimo-m           2499 -> 1790
--   ultrapin           595 -> 350   (matched to NB Sons' single unit)
--   puratin            510 -> 700   (we were under NB Sons; raised to match)
--   stevoice           950 -> 1800  (NB Sons 1800, strikethrough 3500)
-- original_price set to NB Sons' compare_at where they show one, else cleared
-- so the strikethrough stays valid (>= price).
update products set price = 3500, original_price = 6500 where slug = 'argivital-sachet';
update products set price = 1790                          where slug = 'trimo-m';
update products set price = 350,  original_price = null   where slug = 'ultrapin';
update products set price = 700,  original_price = null   where slug = 'puratin';
update products set price = 1800, original_price = 3500   where slug = 'stevoice';
