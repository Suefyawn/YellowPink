-- ============================================================================
-- Publish VERSUS Marine Collagen — meets real, measured demand.
--
-- The Search-demand report showed shoppers searching "collagen supplement" on
-- site (and the collagen buyer-guide pulls organic traffic), but the one
-- collagen supplement in the catalogue sat in `draft` with a placeholder TODO
-- description. It already has the genuine manufacturer product photo
-- (public/catalog/collagen-peptides-powder.png) and a set price, so this fills
-- in real copy and publishes it.
--
-- Copy is factual (product format + general collagen context), no invented
-- clinical claims — wellness PDPs already carry the food-supplement disclaimer.
-- ============================================================================

update public.products set
  status = 'published',
  short_description = 'Hydrolysed marine collagen from wild cod, 10g per single-serve sachet, 24 sachets per box. An unflavoured daily "beauty from within" scoop for skin, hair, nails and joints that mixes into water, tea or a smoothie.',
  description = $d$VERSUS Marine Collagen is a hydrolysed collagen supplement made from wild cod, giving you 10g of marine collagen peptides in every single-serve sachet. Marine collagen peptides are small and highly soluble, so they mix in easily and are gentle on the stomach.

Collagen is the protein that keeps skin springy and helps hair, nails and joints stay resilient. Your body's own collagen production starts to slow from your mid-twenties, which is why a daily collagen scoop has become a staple "beauty from within" habit.

Each box holds 24 unflavoured Original sachets. Tip one into water, juice, tea or your morning smoothie once a day. No fishy taste, no fuss.

100% genuine and sealed, with cash on delivery across Pakistan. 10g x 24 sachets.$d$,
  key_benefits = $kb$[
    {"icon":"sparkle","text":"10g hydrolysed marine collagen per sachet"},
    {"icon":"droplet","text":"For skin, hair, nails and joints"},
    {"icon":"leaf","text":"Wild cod source, unflavoured Original"},
    {"icon":"sun","text":"Easy daily scoop, mixes with no fishy taste"}
  ]$kb$::jsonb,
  seo_title = 'VERSUS Marine Collagen (24 Sachets) Price in Pakistan',
  seo_description = 'Buy VERSUS Marine Collagen in Pakistan: 10g hydrolysed wild-cod collagen per sachet, 24 unflavoured sachets for skin, hair and nails. Authentic, PKR 6,400, COD.',
  updated_at = now()
where slug = 'collagen-peptides-powder' and status = 'draft';
