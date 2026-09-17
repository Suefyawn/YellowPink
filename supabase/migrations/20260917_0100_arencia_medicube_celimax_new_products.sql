-- Nine imported K-beauty products, published directly.
-- ======================================================
--
-- Owner's list, 17 Sep 2026 (Workbook1.xlsx on the desktop): seven Arencia
-- lines, one Medicube, one Celimax. Prices are the owner's own "OUR PRICE"
-- column, so unlike the 14 Sep hair drafts they are NOT extrapolated and do
-- not need confirming. Source column says "Glow care" (Medicube and Celimax
-- also "makeupbeauty"); neither is a row in public.vendors yet, so vendor_id
-- stays null like every other K-beauty row.
--
-- Owner instruction: "make them live direct with inventory externally
-- managed". So status = 'published' and stock_mode = 'external' with
-- track_inventory = false, the same shape as the rest of the K-beauty shelf
-- (Medicube, Celimax, Anua, COSRX all run this way). They never show as sold
-- out; the supplier holds the stock.
--
-- Arencia is a NEW brand for the store. Medicube (7 live) and Celimax (2 live)
-- already have shelves. Arencia's rice mochi cleansers are the store's first
-- K-beauty cleanser line beyond the COSRX snail gel wash.
--
-- IMAGES ship in the same commit under public/product-images/<slug>.webp,
-- 1200x1200 on white, the convention set on 15 Sep for the hair packshots.
-- All are the brands' own official packshots (docs/PRODUCT-IMAGES.md,
-- Route 2): arencia.us and arencia.co.kr for Arencia, medicube.us for
-- Medicube, celimax.com for Celimax. Two retouches worth recording: the
-- Fresh Green jar's Korean-site shot carried a Hwahae award roundel, painted
-- out; the Celimax tube's shot had a rendered floor shadow, removed. A US
-- promo shot with a "BOGO 50%" badge and a price-badge shot were rejected in
-- favour of the clean Korean-site packshots.
--
-- COPY. Written from the brands' own product pages (claims, featured
-- ingredients, directions). Full INCI lists were only published for the
-- Celimax cream (celimax.com) and the Medicube mask (medicube.us); for the Arencia lines the ingredients
-- field carries the brand's featured-ingredient list rather than an invented
-- INCI string.
--
-- NAMING. The Vitamin C Booster Shot is named with "Serum" so the smart
-- "serums" collection (title contains "serum") picks it up; it is a serum,
-- Arencia just brands it as a shot. The cleansers all carry "Cleanser" in the
-- title and land in the "cleansers" collection automatically. The Pore Melt
-- cleansing oil did not, and neither did the Medicube cleansing oil already
-- on the shelf, so the cleansers rule is widened below to include
-- "cleansing oil". Ingredient collections (vitamin-c, niacinamide,
-- hyaluronic-acid, salicylic-acid) are tag-driven and mapped at the end.

begin;

insert into public.products
  (slug, brand, name, price, category, subcategory, status, kind, stock_mode,
   track_inventory, stock, continue_selling_when_out, packaging, weight_grams,
   image_url, short_description, description, how_to_use, ingredients,
   key_benefits, faq, seo_title, seo_description)
values

-- ── Arencia ───────────────────────────────────────────────────────────────
( 'arencia-vitamin-c-booster-shot', 'Arencia',
  'Arencia Vitamin C Booster Shot Serum 30ml',
  4500, 'Cleansers & Treatments', 'Skin Serum', 'published', 'simple', 'external', false, 0, true, 'standard', 120,
  '/product-images/arencia-vitamin-c-booster-shot.webp',
  'Concentrated vitamin C serum with 5% ethyl ascorbic acid, pure vitamin C, glutathione and niacinamide. For dull, uneven skin that wants a visible lift in brightness.',
  E'A vitamin C serum in a tube rather than a dropper, which keeps the vitamin C away from air and light for longer. Arencia pairs 3-O-ethyl ascorbic acid at 50,000ppm (5%), a stable form that does not sting the way pure L-ascorbic acid can, with a small amount of pure vitamin C for the immediate effect.\n\nGlutathione and vitamin E sit alongside as antioxidants, niacinamide evens tone and texture, and panthenol and allantoin keep the formula comfortable on skin that usually reacts to actives.\n\nThe texture is a light, fast-absorbing gel that layers under sunscreen in the morning or moisturiser at night without pilling.',
  E'Start every other day. Apply a small amount to clean, dry skin, then moisturiser and, in the morning, sunscreen. Once your skin is used to it, daily use is fine. Do not layer with retinoids or exfoliating acids in the same routine. Patch test first if you are new to vitamin C.',
  'Key ingredients: 3-O-Ethyl Ascorbic Acid 50,000ppm, Ascorbic Acid (pure vitamin C), Niacinamide, Glutathione, Tocopherol (vitamin E), Panthenol, Allantoin.',
  '[{"icon":"sparkle","text":"5% stabilised vitamin C plus pure vitamin C"},{"icon":"shield","text":"Glutathione and vitamin E antioxidants"},{"icon":"droplet","text":"Niacinamide for tone and texture"},{"icon":"flower","text":"Panthenol and allantoin keep it gentle"}]'::jsonb,
  '[{"q":"Will it sting?","a":"Ethyl ascorbic acid is far gentler than pure L-ascorbic acid, and the formula includes panthenol and allantoin to calm. Most people feel nothing. If you are new to vitamin C, start every other day."},
    {"q":"Morning or night?","a":"Either. In the morning it adds antioxidant protection under sunscreen. At night it works while you sleep. Do not use it in the same routine as retinal or an exfoliating acid."},
    {"q":"How long until I see a difference?","a":"Brightness usually shows within two to three weeks of regular use. Dark spots take longer, six to eight weeks, and only with daily sunscreen."},
    {"q":"Why a tube and not a dropper bottle?","a":"Vitamin C oxidises when it meets air and light. A sealed tube keeps it fresh for the whole 30ml rather than the first few weeks."}]'::jsonb,
  'Arencia Vitamin C Booster Shot Serum in Pakistan',
  'Arencia Vitamin C Booster Shot 30ml with 5% ethyl ascorbic acid, pure vitamin C, glutathione and niacinamide. Brightens dull, uneven skin. Original Arencia, COD across Pakistan.'),

( 'arencia-fresh-blue-hyssop-rice-mochi-cleanser', 'Arencia',
  'Arencia Fresh Blue Hyssop Rice Mochi Cleanser 120g',
  5999, 'Cleansers & Treatments', 'Face Wash', 'published', 'simple', 'external', false, 0, true, 'standard', 220,
  '/product-images/arencia-fresh-blue-hyssop-rice-mochi-cleanser.webp',
  'Clay and hyssop rice mochi cleanser for oily, congested skin. Pulls sebum out of pores and calms the skin at the same time.',
  E'Arencia''s rice mochi cleansers are kneaded from rice powder and fermented for 72 hours, which gives them a soft, stretchy texture closer to dough than to a gel. They foam gently, cleanse deeply and rinse clean.\n\nBlue Hyssop is the version for oily and congested skin. Bentonite clay draws out sebum, hyssop extract soothes, chaga mushroom brings beta-glucan for hydration so the clay does not leave skin tight, and the fine rice powder lifts dead skin without scrubbing.\n\nUsed thicker, it doubles as a wash-off clay mask once or twice a week.',
  E'Take a small amount, lather with water into a soft foam and massage over the face in circles, spending longest on the T-zone. Rinse with lukewarm water. For a deeper pore cleanse, apply a thicker layer as a mask for three to five minutes once or twice a week, then rinse.',
  'Key ingredients: Bentonite clay, Hyssopus Officinalis (hyssop) extract, Inonotus Obliquus (chaga) extract, black barley extract, Camellia Sinensis (green tea) extract, rice powder, rice extract. Hand-kneaded rice mochi base, fermented 72 hours with over 30 plant-derived ingredients.',
  '[{"icon":"droplet","text":"Bentonite clay clears excess sebum"},{"icon":"leaf","text":"Hyssop and green tea calm oily skin"},{"icon":"sparkle","text":"Rice powder refines pores without scrubbing"},{"icon":"flower","text":"Doubles as a clay mask once a week"}]'::jsonb,
  '[{"q":"What is a rice mochi cleanser?","a":"A cleanser made by kneading rice powder into a dough and fermenting it. The texture is soft and stretchy, foams gently and rinses clean. Arencia is the brand that made the format popular in Korea."},
    {"q":"Which Arencia cleanser is for oily skin?","a":"This one, or the Black Tea and Yuzu version if blackheads are the main concern. Fresh Green is for normal to combination skin, Calendula for dry or sensitive skin, and Rice Mucin for hydration."},
    {"q":"Will clay dry my skin out?","a":"Less than a clay mask, because the chaga and black barley extracts hold moisture. If your skin is dry as well as congested, use it as a twice-weekly mask and a gentler wash the rest of the time."},
    {"q":"How much do I use?","a":"A fingertip-sized piece. It goes further than a gel because the foam comes from the rice, not from a large volume of product."}]'::jsonb,
  'Arencia Blue Hyssop Rice Mochi Cleanser in Pakistan',
  'Arencia Fresh Blue Hyssop Rice Mochi Cleanser 120g with bentonite clay, hyssop and rice powder for oily, congested skin. Original Arencia, COD across Pakistan.'),

( 'arencia-black-tea-yuzu-rice-mochi-cleanser', 'Arencia',
  'Arencia Black Tea & Yuzu Rice Mochi Cleanser 120g',
  6999, 'Cleansers & Treatments', 'Face Wash', 'published', 'simple', 'external', false, 0, true, 'standard', 220,
  '/product-images/arencia-black-tea-yuzu-rice-mochi-cleanser.webp',
  'Charcoal, fermented black tea and yuzu in a rice mochi cleanser built for blackheads and rough, oily texture.',
  E'The blackhead version of the rice mochi cleanser. Charcoal draws out what is sitting in the pore, fermented black tea brings antioxidants, yuzu adds a light vitamin C brightening effect, and the rice base gently lifts the dead skin that makes pores look larger than they are.\n\nIt is deeper-cleaning than the Fresh Green or Calendula versions, so it suits oily and combination skin, and works best on the nose, chin and forehead where blackheads gather.\n\nLike the rest of the range it is hand-kneaded and fermented for 72 hours, foams softly and rinses without residue.',
  E'Lather a small amount with water and massage over the face, spending longest on the nose and chin. Rinse with lukewarm water. Once or twice a week, apply a thicker layer to blackhead-prone areas and leave for three to five minutes as a wash-off mask before rinsing.',
  'Key ingredients: Charcoal powder, fermented Camellia Sinensis (black tea) extract, Citrus Junos (yuzu) fruit extract, rice powder, rice extract, mild plant-based exfoliants. Hand-kneaded rice mochi base, fermented 72 hours.',
  '[{"icon":"droplet","text":"Charcoal draws out blackheads"},{"icon":"leaf","text":"Fermented black tea antioxidants"},{"icon":"sparkle","text":"Yuzu for a brighter finish"},{"icon":"shield","text":"Cleans deeply without stripping"}]'::jsonb,
  '[{"q":"Is this the strongest Arencia cleanser?","a":"It is the deepest-cleaning of the five. If your skin is dry or easily irritated, choose Calendula or Rice Mucin instead and use this only as a weekly mask on the nose."},
    {"q":"Will it remove blackheads in one wash?","a":"No cleanser does. It loosens the oxidised sebum that makes blackheads dark and, used consistently, keeps pores clearer. Pair it with a BHA product for faster results."},
    {"q":"Can I use it every day?","a":"Oily skin can. Combination skin is better with every other day, alternating with a gentler wash."}]'::jsonb,
  'Arencia Black Tea & Yuzu Rice Mochi Cleanser in Pakistan',
  'Arencia Black Tea & Yuzu Rice Mochi Cleanser 120g with charcoal and fermented black tea for blackheads and oily skin. Original Arencia, COD across Pakistan.'),

( 'arencia-pore-melt-mochi-cleansing-oil', 'Arencia',
  'Arencia Pore Melt Mochi Cleansing Oil 200ml',
  6500, 'Cleansers & Treatments', 'Face Wash', 'published', 'simple', 'external', false, 0, true, 'standard', 300,
  '/product-images/arencia-pore-melt-mochi-cleansing-oil.webp',
  'Non-comedogenic cleansing oil that melts sunscreen and makeup, then emulsifies and rinses clean. The first step of a double cleanse.',
  E'A cleansing oil is the only thing that reliably removes sunscreen and long-wear makeup, and most of them clog pores while doing it. This one is formulated without 29 known pore-clogging ingredients, checked against the same comedogenicity database dermatologists use, so it is safe for acne-prone skin.\n\nOlive oil does the dissolving. Rice amino acids, cica and ceramide NP look after the barrier, and a botanical blend of green tea, mugwort, tea tree, houttuynia and mung bean keeps the skin calm. Add water and it turns milky and rinses off without a film.\n\nFollow with any rice mochi cleanser for a full double cleanse.',
  E'On a dry face with dry hands, pump two or three times and massage for 30 to 60 seconds, working over the eyes, the hairline and anywhere sunscreen sits. Wet your hands and keep massaging until the oil turns milky, then rinse with lukewarm water. Follow with a water-based cleanser.',
  'Key ingredients: Olea Europaea (olive) fruit oil, rice amino acids, Oryza Sativa (rice) extract, rice lees extract, Tocopherol (vitamin E), Centella Asiatica extract, Ceramide NP, Camellia Sinensis leaf extract, Artemisia (mugwort) extract, Melaleuca Alternifolia (tea tree) extract, Houttuynia Cordata extract, mung bean extract. Formulated without 29 comedogenic ingredients (no coconut oil, lanolin, isopropyl myristate, ethylhexyl palmitate or myristyl myristate).',
  '[{"icon":"droplet","text":"Melts sunscreen and waterproof makeup"},{"icon":"shield","text":"Non-comedogenic, safe for acne-prone skin"},{"icon":"leaf","text":"Cica, ceramide and rice amino acids"},{"icon":"sparkle","text":"Emulsifies and rinses with no film"}]'::jsonb,
  '[{"q":"Do I need a cleansing oil if I only wear sunscreen?","a":"Yes. Modern sunscreens are built to stay put, and a foaming cleanser alone leaves a layer behind. That layer is what clogs pores over time."},
    {"q":"Will oil make my acne worse?","a":"Not this one. It is formulated without the 29 ingredients most associated with clogged pores, which is the part that matters, not the word oil."},
    {"q":"Can it remove eye makeup?","a":"Yes, including waterproof mascara. Massage gently over closed eyes and rinse well."},
    {"q":"Which cleanser goes after it?","a":"Any of the Arencia rice mochi cleansers. Blue Hyssop or Black Tea for oily skin, Fresh Green for most skin, Calendula or Rice Mucin for dry or sensitive skin."}]'::jsonb,
  'Arencia Pore Melt Cleansing Oil in Pakistan',
  'Arencia Pore Melt Mochi Cleansing Oil 200ml, non-comedogenic makeup remover with olive oil, cica and ceramide. Melts sunscreen and rinses clean. Original Arencia, COD across Pakistan.'),

( 'arencia-fresh-green-rice-mochi-cleanser', 'Arencia',
  'Arencia Fresh Green Rice Mochi Cleanser 120g',
  6999, 'Cleansers & Treatments', 'Face Wash', 'published', 'simple', 'external', false, 0, true, 'standard', 220,
  '/product-images/arencia-fresh-green-rice-mochi-cleanser.webp',
  'The original rice mochi cleanser. Green tea, rice and mung bean for normal to combination skin that gets congested.',
  E'This is the cleanser Arencia is known for, and the one Korean dermatologists most often recommend from the range. Clinically tested to improve seven visible measures in a single use, including pore congestion, blackheads, surface texture and how well the skin absorbs what goes on after.\n\nGreen tea is the antioxidant, rice water and rice powder gently buff away dead skin, mung bean soothes and witch hazel tightens the look of pores without drying them out.\n\nIf you are choosing one Arencia cleanser and your skin is not especially dry or especially oily, start here.',
  E'Lather a small amount with water and massage over the face in circles for about a minute. Rinse with lukewarm water and pat dry. Once or twice a week, apply a thicker layer and leave for three to five minutes as a wash-off mask.',
  'Key ingredients: Camellia Sinensis (green tea) extract, rice water, rice powder, Oryza Sativa (rice) extract, mung bean extract, Hamamelis Virginiana (witch hazel) extract. Hand-kneaded rice mochi base, fermented 72 hours at low temperature with over 30 plant-derived ingredients.',
  '[{"icon":"sparkle","text":"Clinically tested on seven skin measures"},{"icon":"leaf","text":"Green tea, rice and mung bean"},{"icon":"droplet","text":"Clears congestion without tightness"},{"icon":"flower","text":"Suits normal, combination and congested skin"}]'::jsonb,
  '[{"q":"Which Arencia cleanser should I start with?","a":"This one, unless your skin is clearly oily (Blue Hyssop), blackhead-prone (Black Tea and Yuzu), dry or sensitive (Calendula) or dehydrated (Rice Mucin)."},
    {"q":"Is it exfoliating?","a":"Mildly. The rice powder is very fine and lifts dead skin as you massage. It is gentle enough for daily use and does not replace a proper acid exfoliant."},
    {"q":"Does it remove makeup?","a":"Light makeup and sweat, yes. Sunscreen and long-wear makeup need a cleansing oil first; the Pore Melt oil is made to pair with it."}]'::jsonb,
  'Arencia Fresh Green Rice Mochi Cleanser in Pakistan',
  'Arencia Fresh Green Rice Mochi Cleanser 120g with green tea, rice and mung bean. The original Korean rice cleanser for congested skin. Original Arencia, COD across Pakistan.'),

( 'arencia-calendula-rice-mochi-cleanser', 'Arencia',
  'Arencia Calendula Rice Mochi Cleanser 120g',
  5999, 'Cleansers & Treatments', 'Face Wash', 'published', 'simple', 'external', false, 0, true, 'standard', 220,
  '/product-images/arencia-calendula-rice-mochi-cleanser.webp',
  'The rice mochi cleanser for dry, sensitive or reddened skin. Calendula and heartleaf calm, cactus extract keeps moisture in.',
  E'Same rice mochi base as the rest of the range, built for skin that goes tight or red after washing. Calendula soothes visible redness, heartleaf (houttuynia) is the K-beauty standard for calming reactive skin, and cactus stem extract holds water in the barrier so the skin does not dry out between cleansing and moisturising.\n\nThe rice powder is still there for a gentle daily polish, but the formula is the softest of the five. It suits dry skin, sensitive skin, skin recovering from a retinoid or acid, and anyone whose face stings with a normal foaming wash.',
  E'Lather a small amount with water and massage gently over the face. Rinse with lukewarm water and pat dry rather than rubbing. For extra soothing, apply a thicker layer and leave for three to five minutes as a wash-off mask once or twice a week.',
  'Key ingredients: Calendula Officinalis flower extract, Houttuynia Cordata (heartleaf) extract, Opuntia (cactus) stem extract, rice powder, Oryza Sativa (rice) extract. Hand-kneaded rice mochi base, fermented 72 hours.',
  '[{"icon":"flower","text":"Calendula calms visible redness"},{"icon":"leaf","text":"Heartleaf for reactive, sensitive skin"},{"icon":"droplet","text":"Cactus extract locks in moisture"},{"icon":"shield","text":"Softest cleanser in the Arencia range"}]'::jsonb,
  '[{"q":"Does it foam?","a":"Softly. The foam comes from the rice base rather than sulfates, so it is lower and creamier than a typical face wash."},
    {"q":"Can I use it while on retinol or tretinoin?","a":"Yes. A gentle, non-stripping cleanser is exactly what a retinoid routine needs. Skip the mask use on peeling days."},
    {"q":"My skin is dry but I get blackheads on my nose.","a":"Use Calendula as your daily wash and the Black Tea and Yuzu cleanser as a weekly mask on the nose only."}]'::jsonb,
  'Arencia Calendula Rice Mochi Cleanser in Pakistan',
  'Arencia Calendula Rice Mochi Cleanser 120g with calendula, heartleaf and cactus extract for dry, sensitive skin. Original Arencia, COD across Pakistan.'),

( 'arencia-rice-mucin-cleanser', 'Arencia',
  'Arencia Rice Mucin Cleanser 120g',
  5999, 'Cleansers & Treatments', 'Face Wash', 'published', 'simple', 'external', false, 0, true, 'standard', 220,
  '/product-images/arencia-rice-mucin-cleanser.webp',
  'Hydrating rice cleanser with 97,500ppm fermented rice extract, three weights of hyaluronic acid and niacinamide. For dehydrated or dull skin.',
  E'Where the other rice mochi cleansers focus on clearing pores, this one focuses on putting moisture back. Fermented rice extract at 97,500ppm (nearly 10%) is the headline, rich in amino acids, and it is backed by three molecular weights of hyaluronic acid, beta-glucan, niacinamide and panthenol.\n\nArencia''s own testing showed higher skin moisture, smoother texture and clearer pores after a single wash. The foam is soft and cushiony, and the skin is left plump rather than squeaky.\n\nIt suits every skin type, and is the pick for dehydrated, dull or mature skin, or anyone who finds foaming cleansers leave them tight.',
  E'Lather a small amount with water and massage over the face for about a minute. Rinse with lukewarm water. It is gentle enough for morning and evening use.',
  'Key ingredients: fermented Oryza Sativa (rice) extract 97,500ppm, rice powder, rice bran extract, snail secretion filtrate (small amount), sodium hyaluronate (three molecular weights), beta-glucan, Niacinamide, Panthenol.',
  '[{"icon":"droplet","text":"Nearly 10% fermented rice extract"},{"icon":"sparkle","text":"Three weights of hyaluronic acid"},{"icon":"leaf","text":"Niacinamide and beta-glucan"},{"icon":"flower","text":"Plump, soft finish, no tightness"}]'::jsonb,
  '[{"q":"Does it contain snail mucin?","a":"A small amount of snail secretion filtrate alongside the rice, hence the name. If you avoid animal-derived ingredients, choose the Calendula cleanser instead."},
    {"q":"Rice Mucin or Calendula for dry skin?","a":"Rice Mucin if the problem is dehydration and dullness. Calendula if the problem is redness and sensitivity."},
    {"q":"Can oily skin use it?","a":"Yes. Oily skin is often dehydrated underneath, and a hydrating cleanser can reduce the rebound oil that a stripping wash causes."}]'::jsonb,
  'Arencia Rice Mucin Cleanser in Pakistan',
  'Arencia Rice Mucin Cleanser 120g with 97,500ppm fermented rice extract, hyaluronic acid and niacinamide. Hydrating daily cleanser for dull, dehydrated skin. Original Arencia, COD across Pakistan.'),

-- ── Medicube ──────────────────────────────────────────────────────────────
( 'medicube-zero-pore-blackhead-mud-mask', 'Medicube',
  'Medicube Zero Pore Blackhead Mud Mask 100g',
  4999, 'Cleansers & Treatments', null, 'published', 'simple', 'external', false, 0, true, 'standard', 200,
  '/product-images/medicube-zero-pore-blackhead-mud-mask.webp',
  'Three-minute quick-dry clay mask with AHA, BHA and PHA and five clays of different particle sizes. Pulls blackheads and sebum out and cools the skin while it does.',
  E'A wash-off clay mask designed around one number: three minutes. It dries fast, so the clays only have time to draw out what is loose in the pore rather than dehydrating the whole face the way a 15-minute mask does.\n\nFive clays of different particle sizes reach pores of different sizes. AHA, BHA and PHA loosen the dead skin and oxidised sebum that hold a blackhead in place. It cools on contact, dropping skin temperature noticeably, which is why it feels calming rather than tight.\n\nMedicube''s own single-use test reported sebum down 53% and waste in pores down 98% immediately after one application. Dermatologist tested and low-irritation, alcohol free, formulated without PEGs, parabens or heavy metals. The scent comes from bergamot, lemon and orange peel oils rather than synthetic perfume.\n\nPairs with the Zero Pore Blackhead Cleansing Oil already on the shelf: oil first to soften, mask second to clear.',
  E'On clean, dry skin apply a thick, even layer to the nose, chin, forehead or the whole face. Leave for exactly three minutes, until it has dried, then rinse thoroughly with lukewarm water. Use two or three times a week. Follow with a hydrating toner or serum.',
  'Water, Kaolin (CI 77004), Bentonite, Methylpropanediol, 1,2-Hexanediol, Sodium Hyaluronate, Chlorella Vulgaris Extract, Citrus Aurantium Bergamia (Bergamot) Fruit Oil, Citrus Limon (Lemon) Peel Oil, Citrus Aurantium Dulcis (Orange) Peel Oil, Cynanchum Atratum Extract, Althaea Rosea Flower Extract, Oenothera Biennis (Evening Primrose) Flower Extract, Pinus Palustris Leaf Extract, Pueraria Lobata Root Extract, Ulmus Davidiana Root Extract, Diospyros Kaki Leaf Extract, Vitis Vinifera (Grape) Fruit Extract, Carthamus Tinctorius (Safflower) Flower Extract, Coffea Arabica (Coffee) Seed Extract, Polygonum Cuspidatum Root Extract, Camellia Sinensis Leaf Extract, Castanea Crenata (Chestnut) Shell Extract, Zanthoxylum Piperitum Fruit Extract, Tetrasodium Pyrophosphate, Magnesium Aluminum Silicate, Caprylyl Glycol, Cellulose, Glucose, Butylene Glycol, Allantoin, Fructooligosaccharides, Fructose, Ethylhexylglycerin, Sodium Phytate, Tocopherol, Canadian Colloidal Clay, Gluconolactone, Salicylic Acid, Glycolic Acid, Pentylene Glycol, Montmorillonite, Illite, Methyl Diisopropyl Propionamide, Copper Tripeptide-1, Xanthan Gum, Caffeine, Limonene, Ferric Ammonium Ferrocyanide (CI 77510), Guaiazulene',
  '[{"icon":"bolt","text":"Works in three minutes"},{"icon":"droplet","text":"Five clays draw out sebum and blackheads"},{"icon":"sparkle","text":"AHA, BHA and PHA loosen clogged pores"},{"icon":"shield","text":"Cooling, alcohol free, dermatologist tested"}]'::jsonb,
  '[{"q":"Why only three minutes?","a":"Once clay is fully dry it stops drawing anything out and starts pulling water from your skin. Three minutes is the point where the pore is clear and the face is not."},
    {"q":"Can I use it with the Zero Pore Cleansing Oil?","a":"That is the intended pair. Massage the oil in first to soften blackheads, rinse, then apply the mask. Two or three times a week is enough."},
    {"q":"Is it safe for sensitive skin?","a":"It is dermatologist tested and low-irritation with no alcohol, but it does contain acids and citrus peel oils. Patch test, and start with the nose only."},
    {"q":"Full face or just the T-zone?","a":"Wherever you get blackheads. Most people use it on the nose and chin and save the rest of the tube."}]'::jsonb,
  'Medicube Zero Pore Blackhead Mud Mask in Pakistan',
  'Medicube Zero Pore Blackhead Mud Mask 100g. Three-minute clay mask with AHA, BHA and PHA that pulls out blackheads and sebum. Genuine Medicube, COD across Pakistan.'),

-- ── Celimax ───────────────────────────────────────────────────────────────
( 'celimax-pore-dark-spot-brightening-cream', 'Celimax',
  'Celimax Pore + Dark Spot Brightening Cream 35ml',
  4600, 'Moisturizers', 'Face Moisturizer', 'published', 'simple', 'external', false, 0, true, 'standard', 120,
  '/product-images/celimax-pore-dark-spot-brightening-cream.webp',
  'Niacinamide and tranexamic acid brightening cream from the Pore + Dark Spot line. Targets faint spots, melasma and dark, bumpy pores.',
  E'The cream from the same Celimax line as the Pore + Dark Spot sunscreen already on the shelf. Niacinamide and tranexamic acid are the two ingredients with the best evidence for fading pigmentation, and here they sit in a rich, nourishing base with five ceramides, hydrolysed hyaluronic acid, beta-glucan and adenosine.\n\nIt is made for uneven tone: post-acne marks, sun spots, the darker, rougher look of enlarged pores, and melasma. Celimax reports improvement in under-eye pigmentation and fine lines within two weeks of use.\n\nThe texture is a proper cream rather than a gel, so it works as the last step of a night routine or under sunscreen for dry to normal skin. Oily skin may prefer it at night only.',
  E'Morning and evening, as the last step before sunscreen. Take a small amount and press over the whole face, then go back over dark spots and pigmented pores with a second thin layer. Use with the Pore + Dark Spot sunscreen by day, because pigmentation returns without SPF.',
  'Water, Glycerin, Niacinamide, Tranexamic Acid, Caprylic/Capric Triglyceride, Dipropylene Glycol, 1,2-Hexanediol, Macadamia Integrifolia Seed Oil, Phenyl Trimethicone, Hydrogenated Poly(C6-14 Olefin), Dicaprylyl Ether, Vinyl Dimethicone, Cetearyl Alcohol, Propanediol, Cetearyl Olivate, Glyceryl Stearate SE, Sorbitan Olivate, Ammonium Acryloyldimethyltaurate/VP Copolymer, Behenyl Alcohol, Dimethiconol, Cetearyl Glucoside, Laminaria Japonica Extract, Eclipta Prostrata Leaf Extract, Hydrogenated Lecithin, Ceramide NP, Betaine, Ethylhexylglycerin, Xanthan Gum, Eriobotrya Japonica Leaf Extract, Adenosine, Fructooligosaccharides, Coptis Japonica Root Extract, Cholesterol, Butylene Glycol, Beta-Glucan, Mentha Viridis (Spearmint) Extract, Hydrolyzed Hyaluronic Acid, Theobroma Cacao (Cocoa) Seed Extract, Dextrin, Tocopherol, Ascorbic Acid Polypeptide, Glyceryl Stearate, Ceramide AS, Ceramide AP, Ceramide NS, Ceramide EOP',
  '[{"icon":"sparkle","text":"Niacinamide and tranexamic acid fade dark spots"},{"icon":"droplet","text":"Five ceramides and hyaluronic acid"},{"icon":"shield","text":"Brightens dark, bumpy pigmented pores"},{"icon":"flower","text":"Pairs with the Celimax brightening sunscreen"}]'::jsonb,
  '[{"q":"Is this the same line as the Celimax sunscreen you sell?","a":"Yes. Sunscreen by day, cream morning and night. The sunscreen stops new spots forming and the cream fades the ones you have."},
    {"q":"How long until dark spots fade?","a":"Two to four weeks for fresh post-acne marks, eight to twelve for older sun spots and melasma, and only with daily sunscreen."},
    {"q":"Can it go under makeup?","a":"Yes. Let it absorb for a couple of minutes first. Oily skin may find it rich for daytime and prefer it as a night cream."},
    {"q":"Can I use it with vitamin C or retinal?","a":"Yes. Niacinamide and tranexamic acid are gentle and layer well with both. Apply the cream last."}]'::jsonb,
  'Celimax Pore + Dark Spot Brightening Cream in Pakistan',
  'Celimax Pore + Dark Spot Brightening Cream 35ml with niacinamide and tranexamic acid fades dark spots and pigmented pores. Original K-beauty, COD across Pakistan.');

-- ── Ingredient tags → smart collections ──────────────────────────────────
insert into public.product_tag_map (product_id, tag_id)
select p.id, t.id
from public.products p
join public.product_tags t on t.slug = any (
  case p.slug
    when 'arencia-vitamin-c-booster-shot'           then array['vitamin-c', 'niacinamide']
    when 'arencia-rice-mucin-cleanser'              then array['hyaluronic-acid', 'niacinamide']
    when 'medicube-zero-pore-blackhead-mud-mask'    then array['salicylic-acid', 'hyaluronic-acid']
    when 'celimax-pore-dark-spot-brightening-cream' then array['niacinamide', 'hyaluronic-acid']
    else array[]::text[]
  end)
where p.slug in (
  'arencia-vitamin-c-booster-shot',
  'arencia-rice-mucin-cleanser',
  'medicube-zero-pore-blackhead-mud-mask',
  'celimax-pore-dark-spot-brightening-cream'
)
on conflict do nothing;

-- A cleansing oil is a cleanser. The "cleansers" smart collection matched only
-- "cleanser" and "face wash" in the title, which left the Medicube Zero Pore
-- cleansing oil off the page and would have left the Arencia Pore Melt off it
-- too.
update public.collections
set rules = '{"match":"any","conditions":[
  {"op":"contains","field":"title","value":"cleanser"},
  {"op":"contains","field":"title","value":"face wash"},
  {"op":"contains","field":"title","value":"cleansing oil"}]}'::jsonb,
    updated_at = now()
where slug = 'cleansers';

commit;
