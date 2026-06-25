-- ============================================================================
-- Keyword-informed SEO meta backfill (91 products with no seo_title / seo_description)
--
-- Last session shipped per-page metadata + auto-fallbacks but deliberately
-- left seo_title / seo_description blank so this pass could be data-driven.
-- Titles/descriptions below are informed by Semrush PK keyword volumes
-- (e.g. "niacinamide serum" 14.8k, "magnesium glycinate" 40.5k, "ashwagandha"
-- 22.2k, "folic acid" 22.2k, "vitamin c serum pakistan" 880, "cerave pakistan"
-- 3.6k, "kojic acid cream" 3.6k, "glycolic acid toner" 1.9k).
--
-- Conventions:
--   * seo_title is kept ~45 chars: the root layout appends " | Yellow Pink"
--     via the Next title template, and pageMeta() word-truncates at 60.
--   * seo_description is kept <=158 chars (pageMeta DESC_MAX), benefit-led,
--     with an authenticity / cash-on-delivery line for SERP CTR.
--   * Keyed on slug, set updated_at = now(). Idempotent: re-running re-applies
--     the same values. Only writes the two SEO columns.
-- ============================================================================

-- ── Bestsellers (in stock) ──────────────────────────────────────────────────
update products set seo_title = 'Real Techniques Face Base Brush Set',
  seo_description = 'Real Techniques Face Base Set — 4 makeup brushes for flawless foundation, concealer and powder. Authentic, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'real-techniques-face-base-brush-set';

update products set seo_title = 'Tinted Sunscreen Moisturizer SPF 46 – Pakistan',
  seo_description = 'A lightweight 3-in-1 tinted sunscreen and moisturizer with broad-spectrum SPF 46 for even, protected skin. Authentic, cash on delivery across Pakistan.',
  updated_at = now() where slug = 'tinted-sunscreen-moisturizer-spf-46';

update products set seo_title = 'ABH Glow Seeker Highlighter – Pakistan',
  seo_description = 'Anastasia Beverly Hills Glow Seeker — an illuminating powder for lit-from-within radiance. 100% authentic, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'anastasia-beverly-hills-highlighter-glow-seeker';

update products set seo_title = 'SHEGLAM Risky Business Blush – Pakistan',
  seo_description = 'SHEGLAM Risky Business blush gives a soft, nourishing flush of colour that lasts all day. Authentic SHEGLAM, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'sheglam-blush-risky-business';

update products set seo_title = 'CeraVe Moisturizing Cream 340g – Pakistan',
  seo_description = 'CeraVe Moisturizing Cream — rich, non-greasy hydration with 3 essential ceramides and hyaluronic acid for face and body. Authentic, COD across Pakistan.',
  updated_at = now() where slug = 'cerave-moisturizing-cream-340-grams';

-- ── Bone & Joint (NB Sons) ──────────────────────────────────────────────────
update products set seo_title = 'Meth D – Vitamin B12 + D3 Supplement (NB Sons)',
  seo_description = 'Meth D by NB Sons — methylcobalamin (active vitamin B12) with vitamin D3 to support nerve health, energy and healthy blood. COD across Pakistan.',
  updated_at = now() where slug = 'meth-d';

-- ── Brushes & Tools ─────────────────────────────────────────────────────────
update products set seo_title = 'Real Techniques Blush Brush 400 – Pakistan',
  seo_description = 'The Real Techniques 400 Blush Brush blends powder blush evenly for a natural, buildable flush. Authentic, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'blush-brush-by-real-techniques';

update products set seo_title = 'Real Techniques Everyday Essentials Set',
  seo_description = 'Real Techniques Everyday Essentials brush and sponge set for foundation, blush and powder. Authentic, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'real-techniques-brush-set';

-- ── Budget Bundles ──────────────────────────────────────────────────────────
update products set seo_title = 'CeraVe Cleanser Bundle – Save in Pakistan',
  seo_description = 'Three CeraVe facial cleansers in one budget bundle — gentle, hydrating cleansing for every skin type. Authentic, cash on delivery across Pakistan.',
  updated_at = now() where slug = 'cerave-cleansers-in-pakistan';

update products set seo_title = 'CeraVe Cleanser + Moisturizer Bundle – PK',
  seo_description = 'CeraVe Hydrating Facial Cleanser and Moisturizing Cream duo for soft, balanced, hydrated skin. Authentic CeraVe, cash on delivery across Pakistan.',
  updated_at = now() where slug = 'cerave-hydrating-cleanser-and-moisturizing-cream-bundle';

update products set seo_title = 'NARS Blush + Tarte Shape Tape Concealer',
  seo_description = 'Bestselling NARS Orgasm blush paired with Tarte Shape Tape concealer 29N at a bundle price. Authentic, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'nars-blush-and-tarte-concealer-bundle';

update products set seo_title = 'Pixi On-the-Glow Blush Sticks Bundle – PK',
  seo_description = 'All three Pixi On-the-Glow blush sticks — Ruby, Fleur and Juicy — in one set for a dewy, natural flush. Authentic Pixi, cash on delivery across Pakistan.',
  updated_at = now() where slug = 'pixi-blush-sticks-bundle';

-- ── Cleansers & Treatments ──────────────────────────────────────────────────
update products set seo_title = 'Anti-Melasma Cream: Kojic Acid + Glutathione',
  seo_description = 'Target melasma, dark spots and uneven tone with a kojic acid and glutathione brightening cream. Authentic, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'anti-melasma-cream-with-kojic-acid';

update products set seo_title = 'Anua Azelaic Acid 10% + Hyaluron Serum – PK',
  seo_description = 'Anua 10% azelaic acid and hyaluronic acid serum calms redness and refines uneven texture. Authentic Anua, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'anua-azelaic-10-hyaluron-redness-soothing-serum';

update products set seo_title = 'Anua Niacinamide 10% + TXA 4% Serum – PK',
  seo_description = 'Anua dark-spot serum with 10% niacinamide, 4% tranexamic acid and arbutin for a clearer, brighter tone. Authentic Anua, COD across Pakistan.',
  updated_at = now() where slug = 'anua-niacinamide-10-txa-4-serum';

update products set seo_title = 'Axis-Y Dark Spot Correcting Glow Serum – PK',
  seo_description = 'Axis-Y glow serum with niacinamide and squalane targets dark spots and uneven tone for a healthy glow. Authentic Axis-Y, COD across Pakistan.',
  updated_at = now() where slug = 'axis-y-dark-spot-correcting-glow-serum';

update products set seo_title = 'Beauty of Joseon Rice & Honey Glow Mask – PK',
  seo_description = 'Beauty of Joseon creamy rice and honey wash-off mask polishes and nourishes for an instant glow. Authentic BOJ, cash on delivery across Pakistan.',
  updated_at = now() where slug = 'beauty-of-joseon-ground-rice-honey-glow-mask';

update products set seo_title = 'Beauty of Joseon Ginseng + Retinal Eye Serum',
  seo_description = 'Beauty of Joseon Revive eye serum with ginseng and retinal firms, smooths fine lines and revives tired eyes. Authentic BOJ, COD across Pakistan.',
  updated_at = now() where slug = 'beauty-of-joseon-revive-eye-serum-ginseng-retinal';

update products set seo_title = 'Celimax Vita-A Retinal Shot Booster – Pakistan',
  seo_description = 'Celimax The Vita-A Retinal Shot — a concentrated retinal booster that firms, smooths fine lines and refines pores. Authentic, COD across Pakistan.',
  updated_at = now() where slug = 'celimax-retinal-shot-tightening-booster';

update products set seo_title = 'SKIN1004 Centella Brightening Ampoule – PK',
  seo_description = 'SKIN1004 daily ampoule with 4% niacinamide, 2% tranexamic acid and centella to brighten and even tone. Authentic SKIN1004, COD across Pakistan.',
  updated_at = now() where slug = 'centella-tone-brightening-capsule-ampoule-100-ml';

update products set seo_title = 'CeraVe Acne Control Cleanser – Pakistan',
  seo_description = 'CeraVe Acne Control Cleanser with 2% salicylic acid clears breakouts while respecting the skin barrier. Authentic CeraVe, COD across Pakistan.',
  updated_at = now() where slug = 'cerave-acne-control-cleanser';

update products set seo_title = 'CeraVe Hydrating Facial Cleanser – Pakistan',
  seo_description = 'CeraVe Hydrating Facial Cleanser gently cleanses without stripping skin — ceramides plus hyaluronic acid. Authentic CeraVe, COD across Pakistan.',
  updated_at = now() where slug = 'cerave-hydrating-facial-cleanser';

update products set seo_title = 'CeraVe Moisturizing Cream 454g – Pakistan',
  seo_description = 'CeraVe Moisturizing Cream 454g — rich, non-greasy ceramide hydration for dry skin on face and body. Authentic CeraVe, cash on delivery in Pakistan.',
  updated_at = now() where slug = 'cerave-moisturizing-cream-large-jar';

update products set seo_title = 'CeraVe Sheer Tint Mineral Sunscreen SPF 30',
  seo_description = 'CeraVe Sheer Tint mineral sunscreen SPF 30 gives broad-spectrum UVA/UVB protection with a sheer tint and no white cast. Authentic, COD across Pakistan.',
  updated_at = now() where slug = 'cerave-sheer-tint-sunscreen-spf30';

update products set seo_title = 'CeraVe Sunscreen + Cleanser Bundle – Pakistan',
  seo_description = 'CeraVe sunscreen and cleanser duo for clear, protected, radiant skin every day. Authentic CeraVe, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'cerave-sunscreen-and-cleanser-bundle';

update products set seo_title = 'Vitamin C Face Cream with Hyaluronic Acid',
  seo_description = 'Medicated vitamin C face cream with hyaluronic acid and vitamin E brightens, hydrates and evens dull skin. Authentic, cash on delivery across Pakistan.',
  updated_at = now() where slug = 'medicated-vitamin-c-cream';

update products set seo_title = 'Medicube Kojic Acid + Turmeric Gel Mask – PK',
  seo_description = 'Medicube wash-off gel mask with kojic acid and turmeric brightens and clarifies dull, uneven skin. Authentic Medicube, COD across Pakistan.',
  updated_at = now() where slug = 'medicube-kojic-acid-turmeric-brightening-gel-mask';

update products set seo_title = 'Medicube PDRN Pink Peptide Serum – Pakistan',
  seo_description = 'Medicube PDRN Pink Peptide serum revitalises, firms and boosts radiance for plump, glowing skin. Authentic Medicube, COD across Pakistan.',
  updated_at = now() where slug = 'medicube-pdrn-pink-peptide-serum';

update products set seo_title = 'Medicube Red Succinic Acid Peeling Pads',
  seo_description = 'Medicube Red Succinic Acid peeling pads clear pores, smooth texture and calm blemishes. Authentic Medicube, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'medicube-red-succinic-acid-peeling-pad';

update products set seo_title = 'Medicube Zero Pore Blackhead Cleansing Oil',
  seo_description = 'Medicube Zero Pore cleansing oil melts makeup, sunscreen and blackhead-causing buildup for clear pores. Authentic Medicube, COD across Pakistan.',
  updated_at = now() where slug = 'medicube-zero-pore-blackhead-cleansing-oil';

update products set seo_title = 'Mixsoon Bean Essence 100ml – Pakistan',
  seo_description = 'Mixsoon Bean Essence — a single-ingredient fermented soybean essence that hydrates, softens and preps skin. Authentic Mixsoon, COD across Pakistan.',
  updated_at = now() where slug = 'mixsoon-bean-essence';

update products set seo_title = 'Pixi Glow Tonic 5% Glycolic Acid Toner – PK',
  seo_description = 'Pixi Glow Tonic — the award-winning 5% glycolic acid toner that exfoliates for a brighter, smoother glow. Authentic Pixi, COD across Pakistan.',
  updated_at = now() where slug = 'pixi-glow-tonic-5-glycolic-acid-toner';

update products set seo_title = 'The Ordinary 7% Glycolic Acid Toner 240ml',
  seo_description = 'The Ordinary 7% Glycolic Acid Toning Solution smooths texture, evens tone and boosts radiance. Authentic, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'the-ordinary-7-glycolic-acid-toner';

-- ── Combo Packs (NB Sons supplement stacks) ─────────────────────────────────
update products set seo_title = 'Baby Care & Growth Essentials Combo – PK',
  seo_description = 'Complete baby nutrition bundle — iron, folic acid, vitamin D and colic relief in one pack. Authentic NB Sons, cash on delivery across Pakistan.',
  updated_at = now() where slug = 'baby-care-growth-essentials-combo-complete-pediatric-nutrition-bundle';

update products set seo_title = 'Couple Fertility Combo (His & Hers) – Pakistan',
  seo_description = 'Conception-support bundle for both partners — M-Sol and Repro-F for her, Repro-M and Argivital for him. Authentic, cash on delivery across Pakistan.',
  updated_at = now() where slug = 'couple-fertility-combo-his-hers-conception-support-bundle';

update products set seo_title = 'Immunity & Detox Shield Combo – Pakistan',
  seo_description = '360-degree immune and full-body detox bundle with vitamin C, glutathione and moringa. Authentic NB Sons, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'immunity-detox-shield-combo-total-body-defense-bundle';

update products set seo_title = 'Men''s Vitality & Performance Combo – Pakistan',
  seo_description = 'Men''s energy, stamina and vitality stack with ashwagandha — X-Fit, Trimo-M, Argivital and Multiflux. Authentic NB Sons, COD across Pakistan.',
  updated_at = now() where slug = 'mens-vitality-performance-combo-total-male-health-bundle';

update products set seo_title = 'Pregnancy & Prenatal Care Combo – Pakistan',
  seo_description = 'Complete prenatal bundle from conception to breastfeeding — folic acid, iron, calcium and more. Authentic NB Sons, cash on delivery across Pakistan.',
  updated_at = now() where slug = 'pregnancy-prenatal-care-combo-pack-complete-maternal-health-bundle';

update products set seo_title = 'Strong Bones & Joint Health Combo – Pakistan',
  seo_description = 'Bone and joint support bundle with calcium, vitamin K2 + D3 and magnesium. Authentic NB Sons, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'strong-bones-joint-health-combo-complete-skeletal-wellness-bundle';

update products set seo_title = 'Women''s Wellness & Hormonal Balance Combo',
  seo_description = 'Women''s hormone, anemia and urinary-health bundle for everyday balance. Authentic NB Sons, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'womens-wellness-hormonal-balance-combo-complete-female-health-bundle';

-- ── Eyes ────────────────────────────────────────────────────────────────────
update products set seo_title = 'Christine Velvet Eyeshadow Palette 28 Colors',
  seo_description = 'Christine Velvet 28-colour eyeshadow palette — richly pigmented mattes and shimmers for every look. Authentic, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'christine-velvet-eyeshadow-palette-28-colors';

-- ── Face Makeup ─────────────────────────────────────────────────────────────
update products set seo_title = 'AquaColor Face Base – Buy in Pakistan',
  seo_description = 'AquaColor Base goes on in thin layers and sets with loose powder for a smooth, long-wear finish. With cash on delivery across Pakistan.',
  updated_at = now() where slug = 'aquacolor-base';

update products set seo_title = 'Christine Baked Powder Shade 828 – Pakistan',
  seo_description = 'Christine Baked Powder 828 sets foundation and concealer for a natural, radiant finish. Authentic Christine, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'christine-baked-powder-shade-828';

update products set seo_title = 'DRMTLGY Tinted Moisturizer SPF 46 – Pakistan',
  seo_description = 'DRMTLGY Universal Tinted Moisturizer with broad-spectrum SPF 46 evens tone and protects in one step. Authentic, cash on delivery across Pakistan.',
  updated_at = now() where slug = 'drmtlgy-universal-tinted-moisturizer-spf-46';

update products set seo_title = 'Kiko Milano Unlimited Foundation 5.5 Gold',
  seo_description = 'Kiko Milano Unlimited Foundation in 5.5 Gold for a flawless, natural matte finish with long wear. Authentic Kiko Milano, COD across Pakistan.',
  updated_at = now() where slug = 'kiko-milano-unlimited-foundation-5-5-gold';

update products set seo_title = 'NARS Light Reflecting Foundation – Pakistan',
  seo_description = 'NARS Light Reflecting Foundation blends makeup and skincare for a luminous, natural finish in all shades. Authentic NARS, COD across Pakistan.',
  updated_at = now() where slug = 'nars-light-reflecting-foundation';

update products set seo_title = 'NARS Light Reflecting Foundation Mont Blanc',
  seo_description = 'NARS Light Reflecting Foundation in Mont Blanc for a radiant, skincare-infused complexion. Authentic NARS, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'nars-light-reflecting-foundation-mont-blanc';

update products set seo_title = 'Pixi On-the-Glow Bronze – Price in Pakistan',
  seo_description = 'Pixi On-the-Glow Bronze gives a warm, natural sun-kissed glow that melts into skin. Authentic Pixi, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'pixi-bronzer';

update products set seo_title = 'Tarte Shape Tape Creamy Concealer – Pakistan',
  seo_description = 'Tarte Shape Tape creamy concealer — full coverage that brightens, smooths and lasts all day. Authentic Tarte, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'tarte-shape-tape-creamy-concealer';

-- ── Hair Care ───────────────────────────────────────────────────────────────
update products set seo_title = 'Argan Oil of Morocco Hair Mask – Pakistan',
  seo_description = 'Argan Oil of Morocco hair mask by Rozino deeply nourishes and revitalises dry, damaged hair. With cash on delivery across Pakistan.',
  updated_at = now() where slug = 'argan-oil-of-morocco-hair-mask';

-- ── Heart Health ────────────────────────────────────────────────────────────
update products set seo_title = 'Simzyme CoQ10 100mg Supplement – Pakistan',
  seo_description = 'Simzyme CoQ10 100mg supports cellular energy and heart health as an antioxidant. Authentic, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'simzyme-100-mg';

-- ── Highlighters ────────────────────────────────────────────────────────────
update products set seo_title = 'Christine Highlighter 4-in-1 Palette – PK',
  seo_description = 'Christine 4-in-1 highlighter palette for a multi-dimensional, lit-from-within glow. Authentic Christine, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'christine-highlighter-4-in-1-palette';

update products set seo_title = 'Fenty Beauty Diamond Bomb Highlighter – PK',
  seo_description = 'Fenty Beauty Diamond Bomb all-over diamond veil for an intense, jewel-like glow. Authentic Fenty Beauty, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'fenty-beauty-diamond-bomb';

update products set seo_title = 'Pixi Superglow Highlighter Sticks – Pakistan',
  seo_description = 'Pixi Superglow highlighter sticks in 4 shades for an easy, dewy cream glow on the go. Authentic Pixi, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'highlighter-sticks-by-pixi';

update products set seo_title = 'Iconic London Liquid Highlighter – Pakistan',
  seo_description = 'Iconic London Liquid Highlighter delivers an intense, buildable, lit-from-within glow. Authentic, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'iconic-london-liquid-highlighter';

-- ── Immunity ────────────────────────────────────────────────────────────────
update products set seo_title = 'Cee Chewable Vitamin C 500mg – Pakistan',
  seo_description = 'Cee chewable vitamin C 500mg for daily immune support and antioxidant protection. Authentic, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'cee';

update products set seo_title = 'Energy Boost Multivitamin by NB Sons – PK',
  seo_description = 'Energy Boost by NB Sons helps combat fatigue and sharpen physical and mental performance. Authentic NB Sons, cash on delivery across Pakistan.',
  updated_at = now() where slug = 'energy-boost';

update products set seo_title = 'Gluthic Glutathione 500mg + Vitamin C – PK',
  seo_description = 'Gluthic by NB Sons — glutathione 500mg with vitamin C for skin radiance, even tone and elasticity from within. COD across Pakistan.',
  updated_at = now() where slug = 'gluthic';

-- ── Kids ────────────────────────────────────────────────────────────────────
update products set seo_title = 'F.lium Folic Acid Drops for Kids – Pakistan',
  seo_description = 'F.lium children''s folic acid drops in an easy-dose liquid support healthy growth and blood formation. Authentic, cash on delivery across Pakistan.',
  updated_at = now() where slug = 'f-lium-drops';

update products set seo_title = 'SimZee Zinc Syrup for Kids 60ml – Pakistan',
  seo_description = 'SimZee children''s zinc syrup — 20mg elemental zinc per 5ml to support immunity, appetite and growth. Authentic NB Sons, COD across Pakistan.',
  updated_at = now() where slug = 'simzee-zinc-syrup';

-- ── Lip & Cheek Tints ───────────────────────────────────────────────────────
update products set seo_title = 'Dior Rosy Glow Blush – Buy in Pakistan',
  seo_description = 'Dior Rosy Glow blush reveals a custom natural flush that adapts to your skin''s pH. Authentic Dior, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'dior-blush-rosy-glow';

update products set seo_title = 'Glow Recipe Watermelon Flush Cheek Tint',
  seo_description = 'Glow Recipe Watermelon Flush — a dewy, skincare-powered tinted cheek serum for a healthy flush. Authentic, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'glow-recipe-watermelon-flush';

update products set seo_title = 'Huda Beauty Icon Liquid Lipstick – Pakistan',
  seo_description = 'Huda Beauty Icon Liquid Lipstick — bold, long-wear colour in a comfortable matte finish. Authentic Huda Beauty, COD across Pakistan.',
  updated_at = now() where slug = 'huda-beauty-icon-liquid-lipstick';

update products set seo_title = 'Kiko Milano 3D Hydra Lip Gloss – Pakistan',
  seo_description = 'Kiko Milano 3D Hydra Lip Gloss gives bright, glossy, volumised lips with a plumping shine. Authentic Kiko Milano, COD across Pakistan.',
  updated_at = now() where slug = 'kiko-milano-lip-gloss';

update products set seo_title = 'Makeup Revolution Super Dewy Liquid Blush',
  seo_description = 'Makeup Revolution Super Dewy Liquid Blush adds a hint of buildable, dewy tint to cheeks. Authentic, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'makeup-revolution-super-dewy-liquid-blush';

update products set seo_title = 'Milk Jelly Lip & Cheek Tint – Pakistan',
  seo_description = 'Milk Jelly Tint — an award-winning, long-lasting jelly blush and lip stain with a hydrating finish. With cash on delivery across Pakistan.',
  updated_at = now() where slug = 'milk-jelly-tints';

update products set seo_title = 'NARS Afterglow Liquid Blush – Pakistan',
  seo_description = 'NARS Afterglow Liquid Blush builds seamlessly for a streak-free, radiant flush of colour. Authentic NARS, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'nars-afterglow-liquid-blush';

update products set seo_title = 'Pixi On-the-Glow Blush + Bronzer Duo – PK',
  seo_description = 'Pixi On-the-Glow blush and bronzer duo for a sun-kissed, dewy glow in two easy steps. Authentic Pixi, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'pixi-blush-bronzer-duo';

update products set seo_title = 'Pixi On-the-Glow Blush + Highlighter Duo',
  seo_description = 'Pixi On-the-Glow blush and highlighter duo for a universally flattering, dewy glow. Authentic Pixi, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'pixi-blush-highlighter-duo';

update products set seo_title = 'Pixi On-the-Glow Blush Stick Juicy – PK',
  seo_description = 'Pixi On-the-Glow Blush Stick in Juicy — a tinted balm with ginseng and aloe for a dewy flush. Authentic Pixi, COD across Pakistan.',
  updated_at = now() where slug = 'pixi-blush-stick-juicy';

update products set seo_title = 'Pixi On-the-Glow Blush Stick Ruby – PK',
  seo_description = 'Pixi On-the-Glow Blush Stick in Ruby — a tinted balm with ginseng and aloe for a dewy flush. Authentic Pixi, COD across Pakistan.',
  updated_at = now() where slug = 'pixi-blush-stick-ruby';

update products set seo_title = 'Pixi Blush Sticks – Buy 1 Get 1 Free (PK)',
  seo_description = 'Pixi On-the-Glow Blush Sticks with ginseng and aloe — buy one, get one free for a dewy flush. Authentic Pixi, COD across Pakistan.',
  updated_at = now() where slug = 'pixi-blush-sticks-sale';

update products set seo_title = 'Pixi LipGlow Nourishing Lip Balm – Pakistan',
  seo_description = 'Pixi LipGlow softening lip balm instantly nourishes and hydrates with a glossy natural finish. Authentic Pixi, COD across Pakistan.',
  updated_at = now() where slug = 'pixi-lipglow';

update products set seo_title = 'Pixi On-the-Glow Blush Sticks (All Shades)',
  seo_description = 'Pixi On-the-Glow Blush Sticks — tinted balms with ginseng and aloe for a dewy, natural flush. Authentic Pixi, COD across Pakistan.',
  updated_at = now() where slug = 'pixi-blush-sticks-ruby-juicy-fleur';

update products set seo_title = 'Rare Beauty Liquid Blush in Hope – Pakistan',
  seo_description = 'Rare Beauty Soft Pinch Liquid Blush in Hope — weightless, long-lasting and highly blendable. Authentic Rare Beauty, COD across Pakistan.',
  updated_at = now() where slug = 'rare-beauty-liquid-blush-hope';

update products set seo_title = 'Rhode Peptide Lip Tint Raspberry Jelly – PK',
  seo_description = 'Rhode Peptide Lip Tint in Raspberry Jelly — sheer, buildable colour with a rich, nourishing feel. Authentic Rhode, COD across Pakistan.',
  updated_at = now() where slug = 'rhode-lip-tint-raspberry-jelly';

update products set seo_title = 'Rhode Peptide Lip Tints (All Shades) – PK',
  seo_description = 'Rhode Peptide Lip Tints — sheer-but-buildable colour that melts onto lips with peptide care. Authentic Rhode, COD across Pakistan.',
  updated_at = now() where slug = 'rhode-peptide-lip-tints';

update products set seo_title = 'SHEGLAM Lip Plumper – Buy in Pakistan',
  seo_description = 'SHEGLAM Pout-Perfect Shine Lip Plumper for fuller-looking, glossy lips. Authentic SHEGLAM, with cash on delivery across Pakistan.',
  updated_at = now() where slug = 'sheglam-lip-plumper';

update products set seo_title = 'SHEGLAM Color Bloom Liquid Blush – Pakistan',
  seo_description = 'SHEGLAM Color Bloom Liquid Blush in all shades — nourishing, blendable colour for a natural flush. Authentic SHEGLAM, COD across Pakistan.',
  updated_at = now() where slug = 'sheglam-liquid-blush-all-shades';

update products set seo_title = 'Pixi On-the-Glow Blush Stick Fleur – PK',
  seo_description = 'Pixi On-the-Glow Blush Stick in Fleur — a tinted balm with ginseng and aloe for a dewy pink flush. Authentic Pixi, COD across Pakistan.',
  updated_at = now() where slug = 'pixi-blush-stick-fleur';

-- ── Men's Health (NB Sons) ──────────────────────────────────────────────────
update products set seo_title = 'Trimo-M Ashwagandha Men''s Vitality – NB Sons',
  seo_description = 'Trimo-M by NB Sons — a herbal men''s vitality blend with ashwagandha, tribulus, fenugreek and zinc. Authentic, cash on delivery across Pakistan.',
  updated_at = now() where slug = 'trimo-m';

update products set seo_title = 'X-Fit Men''s Vitality Tablet – NB Sons (PK)',
  seo_description = 'X-Fit by NB Sons — men''s vitality tablet with L-arginine, tribulus, vitamin E, zinc and selenium. Authentic, cash on delivery across Pakistan.',
  updated_at = now() where slug = 'x-fit';

-- ── Moisturizers ────────────────────────────────────────────────────────────
update products set seo_title = 'CeraVe Daily Moisturizing Lotion 237ml – PK',
  seo_description = 'CeraVe Daily Moisturizing Lotion — lightweight, oil-free hydration with 3 ceramides and hyaluronic acid. Authentic CeraVe, COD across Pakistan.',
  updated_at = now() where slug = 'cerave-moisturizing-lotion';

update products set seo_title = 'Dr.Althea 345 Relief Cream 50ml – Pakistan',
  seo_description = 'Dr.Althea 345 Relief Cream — a rich barrier-repair cream that relieves dryness and strengthens stressed skin. Authentic, COD across Pakistan.',
  updated_at = now() where slug = 'dr-althea-345-relief-cream';

update products set seo_title = 'I''m From Rice Cream 50g – Buy in Pakistan',
  seo_description = 'I''m From Rice Cream — a rice-extract moisturiser that brightens, nourishes and gives a dewy, glassy finish. Authentic, COD across Pakistan.',
  updated_at = now() where slug = 'im-from-rice-cream';

update products set seo_title = 'Medicube 5% TXA + Niacinamide Capsule Cream',
  seo_description = 'Medicube 5% TXA and niacinamide capsule cream brightens and evens tone for a clearer complexion. Authentic Medicube, COD across Pakistan.',
  updated_at = now() where slug = 'medicube-txa-niacinamide-capsule-cream';

update products set seo_title = 'Medicube Collagen Jelly Cream 110ml – PK',
  seo_description = 'Medicube Collagen Jelly Cream — a bouncy cream that plumps, firms and hydrates for elastic skin. Authentic Medicube, COD across Pakistan.',
  updated_at = now() where slug = 'medicube-collagen-jelly-cream';

update products set seo_title = 'Mixsoon Bean Cream 50ml – Buy in Pakistan',
  seo_description = 'Mixsoon Bean Cream — a fermented soybean moisturiser that nourishes and softens for a healthy glow. Authentic Mixsoon, COD across Pakistan.',
  updated_at = now() where slug = 'mixsoon-bean-cream';

-- ── Sunscreens ──────────────────────────────────────────────────────────────
update products set seo_title = 'SKIN1004 Centella Tone-Up Sunscreen SPF50+',
  seo_description = 'SKIN1004 Madagascar Centella tone-up sunscreen SPF50+ PA++++ brightens and protects with no white cast. Authentic SKIN1004, COD across Pakistan.',
  updated_at = now() where slug = 'skin1004-madagascar-centella-tone-up-sunscreen';

-- ── Women's Health (NB Sons) ────────────────────────────────────────────────
update products set seo_title = 'Calco Fit Magnesium Glycinate 500mg – NB Sons',
  seo_description = 'Calco Fit by NB Sons — gentle, well-absorbed magnesium glycinate 500mg to support muscle relaxation and calm. Authentic, COD across Pakistan.',
  updated_at = now() where slug = 'calco-fit';

update products set seo_title = 'Simfolic Myo-Inositol + Folic Acid for PCOS',
  seo_description = 'Simfolic — myo-inositol 2000mg with folic acid 400mcg to support fertility, ovulation and PCOS care. Authentic, cash on delivery across Pakistan.',
  updated_at = now() where slug = 'simfolic';
