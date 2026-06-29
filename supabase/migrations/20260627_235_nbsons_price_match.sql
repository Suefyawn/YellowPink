-- Exactly match NB Sons' own retail prices (nbsons.com). Compared all 57 NB
-- Sons SKUs against nbsons.com/products.json; 45 already matched. The 4 below
-- were off and are aligned to NB Sons exactly:
--   argivital-sachet  4100 -> 3500   (NB Sons 3500, was 6500)
--   trimo-m           2499 -> 1790
--   puratin            510 -> 700
--   stevoice           950 -> 1800   (NB Sons 1800, was 3500)
-- ultrapin already exact: ours (595) = NB Sons' double-pack price, so no change.
-- original_price set to NB Sons' compare_at where they show one, else cleared
-- so the strikethrough stays valid (>= price). Our custom multi-product
-- bundles aren't sold on nbsons.com and are left unchanged.
update products set price = 3500, original_price = 6500 where slug = 'argivital-sachet';
update products set price = 1790                          where slug = 'trimo-m';
update products set price = 700,  original_price = null   where slug = 'puratin';
update products set price = 1800, original_price = 3500   where slug = 'stevoice';
