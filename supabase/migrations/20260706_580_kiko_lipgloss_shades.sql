-- 580 · Attach shade options to the Kiko Milano 3D Hydra Lip Gloss
--
-- The product was imported as `variable` with 30 per-shade product_variants
-- rows (price/stock preserved) but none were ever linked to attribute values,
-- so the PDP's shade picker (derived from variant_attribute_values ->
-- attribute_values -> product_attributes) rendered nothing and shoppers could
-- not choose a colour. Same class of gap that migration 118 fixed for three
-- other products; the source WooCommerce store is gone, so shades are taken
-- from KIKO's published 3D Hydra Lipgloss range and mapped to the 30 rows in
-- their existing sort order. Non-destructive (adds values + links only; no
-- variant is deleted) and idempotent. Stock stays as-is — the owner tunes
-- per-shade stock (or disables shades not carried) in Admin → Variants.

do $$
declare
  v_attr uuid;
  v_prod uuid := '9ca05632-50b9-444c-b33c-d907456b43ef';
begin
  insert into public.product_attributes (slug, name, visible_on_pdp, usable_in_filter, sort_order)
    values ('shade', 'Shade', true, false, 10)
    on conflict (slug) do nothing;
  select id into v_attr from public.product_attributes where slug = 'shade';

  create temp table _kiko (ord int, slug text, value text, hex text) on commit drop;
  insert into _kiko (ord, slug, value, hex) values
    (1 , 'kiko-3dhg-01-clear',                '01 Clear',                 '#EDE4D9'),
    (2 , 'kiko-3dhg-02-natural-beige',        '02 Natural Beige',         '#D9B99B'),
    (3 , 'kiko-3dhg-03-pearly-apricot',       '03 Pearly Apricot',        '#E8A87C'),
    (4 , 'kiko-3dhg-04-pearly-peach-rose',    '04 Pearly Peach Rose',     '#E7A18B'),
    (5 , 'kiko-3dhg-05-pearly-pink',          '05 Pearly Pink',           '#E9A6B6'),
    (6 , 'kiko-3dhg-06-candy-rose',           '06 Candy Rose',            '#E48AA6'),
    (7 , 'kiko-3dhg-07-pink-magnolia',        '07 Pink Magnolia',         '#E39BB0'),
    (8 , 'kiko-3dhg-08-natural-rosewood',     '08 Natural Rosewood',      '#C78A82'),
    (9 , 'kiko-3dhg-09-soft-coral',           '09 Soft Coral',            '#F08A6E'),
    (10, 'kiko-3dhg-10-sparkling-strawberry', '10 Sparkling Strawberry',  '#E5566B'),
    (11, 'kiko-3dhg-11-golden-red',           '11 Golden Red',            '#C63A2E'),
    (12, 'kiko-3dhg-12-pearly-amaryllis-red', '12 Pearly Amaryllis Red',  '#C43B57'),
    (13, 'kiko-3dhg-13-fire-red',             '13 Fire Red',              '#C0392B'),
    (14, 'kiko-3dhg-15-cherry-red',           '15 Cherry Red',            '#A61E33'),
    (15, 'kiko-3dhg-16-iridescent-ruby',      '16 Iridescent Ruby',       '#9B2242'),
    (16, 'kiko-3dhg-17-pearly-mauve',         '17 Pearly Mauve',          '#B57A93'),
    (17, 'kiko-3dhg-18-golden-sparkle',       '18 Golden Sparkle',        '#C9A24B'),
    (18, 'kiko-3dhg-19-cream-cashmere',       '19 Cream Cashmere',        '#D8B79E'),
    (19, 'kiko-3dhg-20-chestnut',             '20 Chestnut',              '#8C5A4A'),
    (20, 'kiko-3dhg-21-brun-rose',            '21 Brun Rose',             '#A96B63'),
    (21, 'kiko-3dhg-22-sparkling-red-garnet', '22 Sparkling Red Garnet',  '#7E2230'),
    (22, 'kiko-3dhg-23-magenta',              '23 Magenta',               '#B03060'),
    (23, 'kiko-3dhg-26-sparkling-hibiscus',   '26 Sparkling Hibiscus Pink','#D94E7A'),
    (24, 'kiko-3dhg-27-pearly-lavender',      '27 Pearly Lavender',       '#B39BC8'),
    (25, 'kiko-3dhg-30-deep-purple',          '30 Deep Purple',           '#5D3A6B'),
    (26, 'kiko-3dhg-32-pearly-natural-rose',  '32 Pearly Natural Rose',   '#D79FA6'),
    (27, 'kiko-3dhg-33-pearly-watermelon',    '33 Pearly Watermelon',     '#E86A7A'),
    (28, 'kiko-3dhg-34-pearly-blood-orange',  '34 Pearly Blood Orange',   '#D45A3C'),
    (29, 'kiko-3dhg-35-pearly-warm-mauve',    '35 Pearly Warm Mauve',     '#B98594'),
    (30, 'kiko-3dhg-41-rosy-glares',          '41 Rosy Glares',           '#D06A82');

  insert into public.attribute_values (attribute_id, slug, value, color_hex, sort_order)
  select v_attr, k.slug, k.value, k.hex, k.ord from _kiko k
  on conflict (attribute_id, slug)
    do update set value = excluded.value, color_hex = excluded.color_hex, sort_order = excluded.sort_order;

  -- Link each variant (in its existing sort order) to a shade (in list order).
  with vrows as (
    select v.id, row_number() over (order by v.sort_order, v.id) as rn
    from public.product_variants v
    where v.product_id = v_prod
  ),
  srows as (
    select av.id, k.ord as rn
    from _kiko k
    join public.attribute_values av on av.attribute_id = v_attr and av.slug = k.slug
  )
  insert into public.variant_attribute_values (variant_id, attribute_value_id)
  select vr.id, sr.id
  from vrows vr
  join srows sr on sr.rn = vr.rn
  on conflict do nothing;
end $$;
