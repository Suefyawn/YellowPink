-- 590 · Attach shade options to the remaining 16 variable products
--
-- Same import gap as Kiko (migration 580): these products have per-shade
-- variant rows but no attribute-value links, so the PDP shade picker never
-- rendered. The old WooCommerce store (which held the exact wp_variation_id →
-- shade map) is gone, so shades are sourced from each brand's published range.
-- Where a product stocks a subset of the brand's shades, the core/iconic shades
-- are used (see per-product notes in the PR). Non-destructive: adds shade
-- attribute_values + variant_attribute_values links; disables only the phantom
-- extra variant on the one product whose row count exceeds its real shade count
-- (Pixi On-the-Glow Blush: 8 rows, 7 shades). Idempotent; no-op on a fresh DB.

do $$
declare
  v_attr uuid;
begin
  insert into public.product_attributes (slug, name, visible_on_pdp, usable_in_filter, sort_order)
    values ('shade', 'Shade', true, false, 10) on conflict (slug) do nothing;
  select id into v_attr from public.product_attributes where slug = 'shade';

  create temp table _m (pslug text, ord int, sslug text, value text, hex text) on commit drop;
  insert into _m (pslug, ord, sslug, value, hex) values
   ('anastasia-beverly-hills-highlighter-glow-seeker',1,'abhgs-1','Sun Idol','#E8C89B'),
   ('anastasia-beverly-hills-highlighter-glow-seeker',2,'abhgs-2','Enchanted','#C08A4E'),
   ('anastasia-beverly-hills-highlighter-glow-seeker',3,'abhgs-3','Ethereal','#F3E6C6'),
   ('aquacolor-base',1,'aqua-1','White 070','#FFFFFF'),
   ('aquacolor-base',2,'aqua-2','Deep Black 071','#1A1A1A'),
   ('aquacolor-base',3,'aqua-3','Youth Red 079','#C8262B'),
   ('aquacolor-base',4,'aqua-4','Bright Pink R22','#E0509A'),
   ('aquacolor-base',5,'aqua-5','Orange 288','#E8722A'),
   ('aquacolor-base',6,'aqua-6','Bright Yellow 509','#F4D01E'),
   ('aquacolor-base',7,'aqua-7','Medium Green 512','#3B9B4A'),
   ('aquacolor-base',8,'aqua-8','Light Blue 587','#6FB8E0'),
   ('aquacolor-base',9,'aqua-9','Royal Blue 510','#1F4FB0'),
   ('aquacolor-base',10,'aqua-10','Light Lilac G56','#B69AD0'),
   ('aquacolor-base',11,'aqua-11','Medium Brown 043','#6E4A2E'),
   ('milk-jelly-tints',1,'milk-1','Splash','#7B2D4E'),
   ('milk-jelly-tints',2,'milk-2','Chill','#C6362F'),
   ('milk-jelly-tints',3,'milk-3','Spritz','#E8663C'),
   ('milk-jelly-tints',4,'milk-4','Burst','#D64070'),
   ('milk-jelly-tints',5,'milk-5','Fresh','#E88BA0'),
   ('milk-jelly-tints',6,'milk-6','Fizz','#EBA57F'),
   ('dior-blush-rosy-glow',1,'dior-1','001 Pink','#E86A8E'),
   ('dior-blush-rosy-glow',2,'dior-2','004 Coral','#E86B52'),
   ('dior-blush-rosy-glow',3,'dior-3','006 Berry','#9E3B5C'),
   ('dior-blush-rosy-glow',4,'dior-4','012 Rosewood','#C77A6E'),
   ('dior-blush-rosy-glow',5,'dior-5','015 Cherry','#C0304A'),
   ('dior-blush-rosy-glow',6,'dior-6','063 Pink Lilac','#D69BC0'),
   ('dior-blush-rosy-glow',7,'dior-7','077 Candy','#E85A8A'),
   ('dior-blush-rosy-glow',8,'dior-8','103 Toffee','#C98A5E'),
   ('fenty-beauty-diamond-bomb',1,'fenty-1','How Many Carats?!','#E3E0DC'),
   ('fenty-beauty-diamond-bomb',2,'fenty-2','Rosé Rave','#E9BFC9'),
   ('fenty-beauty-diamond-bomb',3,'fenty-3','Cognac Candy','#C98456'),
   ('huda-beauty-icon-liquid-lipstick',1,'huda-1','Icon','#A9645E'),
   ('huda-beauty-icon-liquid-lipstick',2,'huda-2','Trophy Wife','#C58A87'),
   ('huda-beauty-icon-liquid-lipstick',3,'huda-3','Trendsetter','#C25A5C'),
   ('huda-beauty-icon-liquid-lipstick',4,'huda-4','Bombshell','#9E4B52'),
   ('iconic-london-liquid-highlighter',1,'iclon-1','Original','#E8C99B'),
   ('iconic-london-liquid-highlighter',2,'iclon-2','Shine','#E9C6C9'),
   ('iconic-london-liquid-highlighter',3,'iclon-3','Blush','#E3A98F'),
   ('iconic-london-liquid-highlighter',4,'iclon-4','Glow','#C77A4E'),
   ('makeup-revolution-super-dewy-liquid-blush',1,'mrev-1','You Had Me At First Blush','#E85A8A'),
   ('makeup-revolution-super-dewy-liquid-blush',2,'mrev-2','Flushing For You','#D14C6A'),
   ('makeup-revolution-super-dewy-liquid-blush',3,'mrev-3','Fake The Flush','#E8896B'),
   ('makeup-revolution-super-dewy-liquid-blush',4,'mrev-4','Blush Me Up','#B56A5A'),
   ('makeup-revolution-super-dewy-liquid-blush',5,'mrev-5','You Got Me Blushing','#C97080'),
   ('makeup-revolution-super-dewy-liquid-blush',6,'mrev-6','Totally Blushes','#DD6699'),
   ('makeup-revolution-super-dewy-liquid-blush',7,'mrev-7','Fortunately Flushed','#D25E75'),
   ('makeup-revolution-super-dewy-liquid-blush',8,'mrev-8','Blushing In Love','#C56A78'),
   ('nars-afterglow-liquid-blush',1,'narsag-1','Orgasm','#E99A83'),
   ('nars-afterglow-liquid-blush',2,'narsag-2','Behave','#C97B8E'),
   ('nars-afterglow-liquid-blush',3,'narsag-3','Dolce Vita','#B76E79'),
   ('nars-afterglow-liquid-blush',4,'narsag-4','Wanderlust','#C48CA8'),
   ('nars-afterglow-liquid-blush',5,'narsag-5','Brazen','#F08060'),
   ('nars-afterglow-liquid-blush',6,'narsag-6','Insatiable','#7E3F5A'),
   ('nars-afterglow-liquid-blush',7,'narsag-7','Orgasm Rush','#C67A5E'),
   ('nars-afterglow-liquid-blush',8,'narsag-8','Secret Lover','#E56A82'),
   ('pixi-blush-sticks-sale',1,'pxsale-1','Ruby','#C43B4B'),
   ('pixi-blush-sticks-sale',2,'pxsale-2','Juicy','#EF7A52'),
   ('pixi-blush-sticks-sale',3,'pxsale-3','Fleur','#F0B5C4'),
   ('pixi-lipglow',1,'pxlip-1','0300 Ruby','#C43B4B'),
   ('pixi-lipglow',2,'pxlip-2','0307 Juicy','#EF7A52'),
   ('pixi-lipglow',3,'pxlip-3','0316 Fleur','#F0B5C4'),
   ('pixi-blush-sticks-ruby-juicy-fleur',1,'pxblush-1','Ruby','#C43B4B'),
   ('pixi-blush-sticks-ruby-juicy-fleur',2,'pxblush-2','Juicy','#EF7A52'),
   ('pixi-blush-sticks-ruby-juicy-fleur',3,'pxblush-3','Fleur','#F0B5C4'),
   ('pixi-blush-sticks-ruby-juicy-fleur',4,'pxblush-4','CheekTone','#D98A9A'),
   ('pixi-blush-sticks-ruby-juicy-fleur',5,'pxblush-5','Mauve','#C08497'),
   ('pixi-blush-sticks-ruby-juicy-fleur',6,'pxblush-6','Cassis','#8E3A5D'),
   ('pixi-blush-sticks-ruby-juicy-fleur',7,'pxblush-7','Chantilly','#D8A48F'),
   ('pixi-bronzer',1,'pxbronze-1','SoftGlow','#C89A6E'),
   ('pixi-bronzer',2,'pxbronze-2','WarmGlow','#B27B4E'),
   ('pixi-bronzer',3,'pxbronze-3','BeachGlow','#9E6B44'),
   ('pixi-bronzer',4,'pxbronze-4','RichGlow','#8A5733'),
   ('highlighter-sticks-by-pixi',1,'pxhigh-1','IcePearl','#EDE7E0'),
   ('highlighter-sticks-by-pixi',2,'pxhigh-2','PetalDew','#F0CBC4'),
   ('highlighter-sticks-by-pixi',3,'pxhigh-3','GildedGold','#E4C08A'),
   ('highlighter-sticks-by-pixi',4,'pxhigh-4','NaturaLustre','#E9D5B8'),
   ('sheglam-lip-plumper',1,'sglam-1','In Bloom','#D98A9A'),
   ('sheglam-lip-plumper',2,'sglam-2','Makin'' Me Blush','#C87F8C'),
   ('sheglam-lip-plumper',3,'sglam-3','First Crush','#E0928E'),
   ('sheglam-lip-plumper',4,'sglam-4','Peachy Keen','#E8A487'),
   ('sheglam-lip-plumper',5,'sglam-5','Hot Stuff','#C0392B'),
   ('sheglam-lip-plumper',6,'sglam-6','Berry Season','#9B3B5A'),
   ('sheglam-lip-plumper',7,'sglam-7','Spring Fever','#E17A9E'),
   ('sheglam-lip-plumper',8,'sglam-8','Pink Flamingo','#E85F8E'),
   ('sheglam-lip-plumper',9,'sglam-9','Walk On The Beach','#C69688'),
   ('sheglam-lip-plumper',10,'sglam-10','Sepia Kiss','#A9776A'),
   ('sheglam-lip-plumper',11,'sglam-11','Mahogany Magic','#7B4A42'),
   ('sheglam-lip-plumper',12,'sglam-12','Hot Cocoa','#6E4335'),
   ('tarte-shape-tape-creamy-concealer',1,'tarte-1','12N fair neutral','#F0CBAE'),
   ('tarte-shape-tape-creamy-concealer',2,'tarte-2','16N fair-light neutral','#EDC3A2'),
   ('tarte-shape-tape-creamy-concealer',3,'tarte-3','20B light','#E8B896'),
   ('tarte-shape-tape-creamy-concealer',4,'tarte-4','22N light neutral','#E3B08C'),
   ('tarte-shape-tape-creamy-concealer',5,'tarte-5','27B light-medium beige','#D8A57E'),
   ('tarte-shape-tape-creamy-concealer',6,'tarte-6','29N light-medium','#D19A70'),
   ('tarte-shape-tape-creamy-concealer',7,'tarte-7','35N medium','#C08A5E');

  insert into public.attribute_values (attribute_id, slug, value, color_hex, sort_order)
  select v_attr, m.sslug, m.value, m.hex, m.ord from _m m
  on conflict (attribute_id, slug)
    do update set value = excluded.value, color_hex = excluded.color_hex, sort_order = excluded.sort_order;

  with vr as (
    select v.id, p.slug as pslug,
           row_number() over (partition by v.product_id order by v.sort_order, v.id) as rn
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where p.slug in (select distinct pslug from _m)
  ),
  sr as (
    select av.id, m.pslug, m.ord as rn
    from _m m
    join public.attribute_values av on av.attribute_id = v_attr and av.slug = m.sslug
  )
  insert into public.variant_attribute_values (variant_id, attribute_value_id)
  select vr.id, sr.id from vr join sr on sr.pslug = vr.pslug and sr.rn = vr.rn
  on conflict do nothing;

  -- Disable any phantom variant on these products left without a shade link
  -- (only Pixi On-the-Glow Blush: 8 rows vs 7 real shades).
  update public.product_variants v set enabled = false
  where v.product_id in (select id from public.products where slug in (select distinct pslug from _m))
    and not exists (select 1 from public.variant_attribute_values vav where vav.variant_id = v.id);
end $$;
