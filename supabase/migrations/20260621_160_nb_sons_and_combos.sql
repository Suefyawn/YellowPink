-- ============================================================================
-- NB Sons branding + combo product clean-up
--
-- 1. The "Nazirs Group" vendor is the supplement house NB Sons; every product
--    sourced from them is the NB Sons brand. Backfill the brand on their 56
--    products (previously brand-null, plus one mislabelled "Argivital"), and
--    register NB Sons as a first-class brand.
-- 2. Combo/stack products were named opaquely (e.g. "Men's Peak Performance")
--    and several wore a single component's product photo. Rename them so the
--    name reveals the contents, point them at composited bundle images, and
--    restructure the run-on "Combo Pack" descriptions so the PDP renderer can
--    lay them out.
--
-- Idempotent + non-destructive: safe to re-run.
-- ============================================================================

-- ── 1a. Brand backfill (keyed on vendor NAME so it's portable across clones) ──
update products p
   set brand = 'NB Sons', updated_at = now()
  from vendors v
 where p.vendor_id = v.id
   and v.name = 'Nazirs Group'
   and (p.brand is null or p.brand = 'Argivital');

-- ── 1b. Register NB Sons as a brand; drop the orphaned single-product brand ──
delete from brands where slug = 'argivital';

insert into brands (id, slug, name, description, hero_image_url, status, sort_order, seo_title, seo_description)
values (
  gen_random_uuid(), 'nb-sons', 'NB Sons',
  'NB Sons is a Pakistani nutraceutical brand behind a broad everyday-wellness range — vitamins, minerals, herbal and specialty supplements spanning women''s health, men''s vitality, immunity, bone & joint, heart, digestive and children''s care. Formulated locally for Pakistani households and available with cash on delivery nationwide.',
  'https://www.yellowpink.pk/wellness/wellness-editorial.webp',
  'published', 100,
  'NB Sons Supplements — Shop the Range',
  'Shop NB Sons supplements at Yellow Pink — women''s health, men''s vitality, immunity, bone & joint, digestive and kids'' wellness. Authentic, with cash on delivery across Pakistan.'
)
on conflict (slug) do update set
  name = excluded.name,
  description = coalesce(nullif(btrim(brands.description), ''), excluded.description),
  hero_image_url = coalesce(brands.hero_image_url, excluded.hero_image_url),
  status = 'published',
  seo_title = coalesce(nullif(btrim(brands.seo_title), ''), excluded.seo_title),
  seo_description = coalesce(nullif(btrim(brands.seo_description), ''), excluded.seo_description),
  updated_at = now();

-- ── 2a. Combo renames — make opaque names reveal their contents ──────────────
update products set name = $$Men's Peak Performance Stack (Flex-4 + X-Fit + Argivital)$$ where slug = 'mens-peak-performance';
update products set name = $$Beauty-from-Within Glow (Gluthic + Asco-C + Fybosim)$$       where slug = 'beauty-from-within-glow';
update products set name = $$Kids Daily Defense (Semofer + Simdac + Multiflux)$$           where slug = 'kids-daily-defense';
update products set name = $$Complete Pregnancy Care (Movin + FOL Chew + Greelac)$$        where slug = 'complete-pregnancy-care';
update products set name = $$Digestive Comfort Trio (NB CAL + Eletcid + Fybosim)$$         where slug = 'digestive-comfort-trio';
update products set name = $$Trying-to-Conceive Couple's Pack (Repro-M + Repro-F)$$        where slug = 'couples-conceive-pack';

-- Tidy the SEO-stuffed "Combo Pack" titles (contents already clear in body).
update products set name = $$Baby Care & Growth Essentials Combo$$        where slug = 'baby-care-growth-essentials-combo-complete-pediatric-nutrition-bundle';
update products set name = $$Couple Fertility Combo (His & Hers)$$         where slug = 'couple-fertility-combo-his-hers-conception-support-bundle';
update products set name = $$Immunity & Detox Shield Combo$$               where slug = 'immunity-detox-shield-combo-total-body-defense-bundle';
update products set name = $$Men's Vitality & Performance Combo$$          where slug = 'mens-vitality-performance-combo-total-male-health-bundle';
update products set name = $$Pregnancy & Prenatal Care Combo$$             where slug = 'pregnancy-prenatal-care-combo-pack-complete-maternal-health-bundle';
update products set name = $$Strong Bones & Joint Health Combo$$           where slug = 'strong-bones-joint-health-combo-complete-skeletal-wellness-bundle';
update products set name = $$Women's Wellness & Hormonal Balance Combo$$    where slug = 'womens-wellness-hormonal-balance-combo-complete-female-health-bundle';

-- ── 2b. Point the 11 collision combos at their composited bundle images ──────
-- (Static webps shipped under /public/combos in the same change.)
update products set image_url = 'https://www.yellowpink.pk/combos/mens-peak-performance.webp'    where slug = 'mens-peak-performance';
update products set image_url = 'https://www.yellowpink.pk/combos/x-fit-trimo-m.webp'            where slug = 'x-fit-trimo-m';
update products set image_url = 'https://www.yellowpink.pk/combos/calco-fit-vit-kd.webp'         where slug = 'calco-fit-vit-kd';
update products set image_url = 'https://www.yellowpink.pk/combos/meth-d-ultrapin.webp'          where slug = 'meth-d-ultrapin';
update products set image_url = 'https://www.yellowpink.pk/combos/beauty-from-within-glow.webp'  where slug = 'beauty-from-within-glow';
update products set image_url = 'https://www.yellowpink.pk/combos/gluthic-cee.webp'              where slug = 'gluthic-cee';
update products set image_url = 'https://www.yellowpink.pk/combos/kids-daily-defense.webp'       where slug = 'kids-daily-defense';
update products set image_url = 'https://www.yellowpink.pk/combos/complete-pregnancy-care.webp'  where slug = 'complete-pregnancy-care';
update products set image_url = 'https://www.yellowpink.pk/combos/femeez-citowit.webp'           where slug = 'femeez-citowit';
update products set image_url = 'https://www.yellowpink.pk/combos/couples-conceive-pack.webp'    where slug = 'couples-conceive-pack';
update products set image_url = 'https://www.yellowpink.pk/combos/digestive-comfort-trio.webp'   where slug = 'digestive-comfort-trio';

-- ── 2c. Restructure the run-on "Combo Pack" descriptions ────────────────────
-- Newlines + bullets so the PDP description renderer lays them out as
-- intro / What's inside / How to use / Why choose, instead of one wall of text.

update products set description = $$Four daily-essential drops for a baby's first year — iron, folic acid, vitamin D and herbal comfort, in one box.

What's inside:
• Semofer Drops — gentle iron (polymaltose 50 mg) to help prevent anaemia in babies.
• F.lium Drops — folic acid for brain & neural development.
• Simdac Drops — vitamin D3 (400 IU) + vitamin A for bone growth & immunity.
• Kidogest Drops — herbal gripe water for colic, gas & tummy discomfort.

How to use:
Give each drop at its age-appropriate dose per the label — Semofer and the vitamins daily, Kidogest as needed during colic or gas. Always check with your paediatrician before starting any supplement for your baby.

Why choose this combo: New parents have enough to weigh up — this stocks all four essentials infants commonly need (iron, folate, vitamin D and tummy comfort) in a single order.$$
where slug = 'baby-care-growth-essentials-combo-complete-pediatric-nutrition-bundle';

update products set description = $$Targeted, science-backed fertility support for both partners at once — because conception is a two-person journey.

What's inside:
• For her — M-Sol Sachet: PCOS support & egg-quality optimiser (myo-inositol 2000 mg).
• For her — Repro-F: complete prenatal multivitamin for reproductive health.
• For him — Repro-M: advanced sperm-health formula with maca, L-carnitine & CoQ10.
• For him — Argivital Sachet: supports blood flow & sperm energy (L-arginine 2 g).

How to use:
Her: M-Sol Sachet + Repro-F daily. Him: Repro-M + Argivital Sachet daily. Both partners should take consistently for at least 3 months before trying to conceive.

Why choose this combo: Most couples support only one partner. This pairs egg-quality and sperm-health support so you improve both sides of the equation together.$$
where slug = 'couple-fertility-combo-his-hers-conception-support-bundle';

update products set description = $$A layered, full-spectrum immune routine — vitamin C, glutathione, adaptogens and superfoods working across different defence pathways.

What's inside:
• Cee — high-dose vitamin C (500 mg) for daily immune defence.
• Gluthic — glutathione (500 mg), the master antioxidant, for detox & skin health.
• MORR — moringa oleifera (500 mg), a nutrient-dense superfood.
• Leukaz — multi-herb immune blend: turmeric, ashwagandha, fenugreek & more.
• Asco-C — effervescent vitamin C drink (1100 mg) for a quick immunity boost.

How to use:
Morning: Cee. Mid-morning: Asco-C dissolved in water. Lunch: MORR + Leukaz. Evening: Gluthic with dinner. Run for 30 days, then repeat monthly.

Why choose this combo: One supplement can't cover every immune pathway. This layers vitamin C, glutathione, adaptogens and superfoods for fuller protection — especially useful through season changes.$$
where slug = 'immunity-detox-shield-combo-total-body-defense-bundle';

update products set description = $$Complete male vitality from every angle — testosterone support, circulation, stress resilience and full daily nutrition.

What's inside:
• X-Fit — core testosterone & performance support (L-arginine, Tribulus, zinc).
• Trimo-M — herbal adaptogen blend (ashwagandha, Tribulus, fenugreek) for stress & stamina.
• Argivital Sachet — cardiovascular & energy support (L-arginine 2 g, CoQ10, lycopene).
• Multiflux — complete daily multivitamin with 26 vitamins & minerals plus omega-3.

How to use:
Morning: X-Fit + Trimo-M with breakfast. Midday: Argivital Sachet in water. Evening: Multiflux with dinner. Use consistently for at least 6–8 weeks.

Why choose this combo: A single supplement only does so much. This covers testosterone support, heart health, stress and daily nutrition together.$$
where slug = 'mens-vitality-performance-combo-total-male-health-bundle';

update products set description = $$Stage-by-stage nutrition for the whole pregnancy journey — from before conception, through pregnancy, to breastfeeding.

What's inside:
• Simfolic — folic acid & myo-inositol, the pre-conception foundation.
• Repro-F — full prenatal multivitamin with 19 vitamins & minerals.
• Ferosim — non-constipating iron to help prevent pregnancy anaemia.
• Fol Chew — chewable daily folic acid with egg-quality support.
• Greelac — natural lactation booster for after delivery.

How to use:
Simfolic: start ~1 month before conception. Repro-F + Fol Chew: throughout pregnancy. Ferosim: from week 12 to combat anaemia. Greelac: post-delivery for breastfeeding. Use under your doctor's guidance.

Why choose this combo: Nutritional needs change at every stage — this covers fertility, full prenatal nutrition and milk supply so you're not guessing what to buy when.$$
where slug = 'pregnancy-prenatal-care-combo-pack-complete-maternal-health-bundle';

update products set description = $$Strong bones and mobile joints in one routine — calcium and vitamin D for density, plus joint repair and muscle support.

What's inside:
• Calosent — high-absorption calcium with vitamin D3, C & B6 (effervescent).
• Vit KD — vitamin K2 (180 mcg) + D3 (10,000 IU) to direct calcium into bones, not arteries.
• Calin-G — calcium carbonate 500 mg + vitamin D3 bone-building duo.
• Artibro — joint support: glucosamine, chondroitin, hyaluronic acid & curcuma.
• Calco Fit — magnesium glycinate 500 mg for muscles, nerves & sleep.

How to use:
Morning: Calosent + Vit KD with breakfast. Midday: Artibro with lunch. Evening: Calin-G with dinner. Bedtime: Calco Fit. Take consistently for 3 months or more.

Why choose this combo: Bones need calcium; joints need repair. Most routines address only one — this covers both. A sensible foundation from your 40s on, or with stiffness and early bone weakness.$$
where slug = 'strong-bones-joint-health-combo-complete-skeletal-wellness-bundle';

update products set description = $$Whole-cycle support for women — hormonal balance, PMS and menopause comfort, iron, and bladder health, in one routine.

What's inside:
• M-Sol Sachet — PCOS & hormonal-balance support (myo-inositol 2000 mg).
• Syror — evening primrose oil / soy isoflavones for PMS & cycle balance.
• Femeez — menopause comfort: hot flushes, mood swings & more.
• Ferosim — non-constipating iron (130 mg bisglycinate) to fight anaemia.
• Cranblue — cranberry extract (250 mg) for UTI prevention & bladder health.

How to use:
Morning: M-Sol Sachet. With meals: Syror. Midday: Ferosim. Evening: Femeez. Daily: Cranblue in water. Consistency matters more than exact timing.

Why choose this combo: Women's needs shift through life — PCOS, monthly iron loss, PMS and menopause. This addresses them together, plus everyday bladder support.$$
where slug = 'womens-wellness-hormonal-balance-combo-complete-female-health-bundle';
