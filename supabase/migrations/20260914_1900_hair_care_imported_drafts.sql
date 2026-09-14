-- Ten imported hair-care products, as DRAFTS.
--
-- Owner directive, 14 Sep 2026: imported brands only, no cheap local stock
-- (see AGENTS.md). Asked which hair products to add, the owner approved
-- "hair care products from these good brands that we already carry" plus any
-- trending imported lines worth drafting.
--
-- Eight of the ten come from FOUR brands the store already sells, because
-- sourcing one more line from an existing supplier is far cheaper than
-- opening a new one:
--
--   CeraVe          10 products live, avg PKR 6,668
--   OGX              already sells the Argan Oil of Morocco hair MASK
--   The Ordinary     3 products live
--   La Roche-Posay   5 products live, avg PKR 6,947
--
-- The two exceptions are Olaplex (2,400/mo in pk, premium, the single most
-- asked-for repair treatment) and the OGX Tea Tree Mint scalp line.
--
-- ── Why this set, by demand ────────────────────────────────────────────────
-- Semrush pk, checked 14 Sep 2026:
--   hair serum            5,400/mo      keratin shampoo    5,400/mo
--   anti dandruff shampoo 4,400/mo      hair growth serum  4,400/mo
--   sulfate free shampoo  3,600/mo      ogx shampoo        2,900/mo
--   olaplex               2,400/mo      biotin shampoo     2,400/mo
--   hair conditioner      1,300/mo      nizoral            1,300/mo
--
-- It also unblocks two things that were deliberately left broken:
--   • The hair quiz had NO cleanse step, because the store published no
--     shampoo. Six shampoos and three conditioners fix that.
--   • The quiz had no "dandruff & flaky scalp" option, because the store
--     published no anti-dandruff product. Three of these are anti-dandruff,
--     so the option can be added once these go live.
--
-- ── STATUS IS 'draft' ON PURPOSE. Two fields are NOT owner-ready ──────────
--
--   1. image_url is NULL on every row. Product photography is copyrighted
--      and must come from the brand or distributor, not from a web search.
--      A product cannot go live without one.
--   2. price needs confirming against the actual vendor cost, because margin
--      depends on purchase price, which is not knowable from here. Provenance
--      for every figure is in docs/HAIR-CATALOGUE-DRAFTS-2026-09-14.md:
--      researched pk retail for OGX / The Ordinary / Olaplex, and an
--      extrapolation from the brand's own existing price band for the CeraVe
--      and La Roche-Posay lines, which are flagged as unconfirmed.
--
-- Everything else — copy, how-to-use, ingredients, benefits, FAQs, SEO,
-- weights, category — is finished. Confirm the price, add a photo, publish.
--
-- Deliberately NOT tagged into the niacinamide / hyaluronic-acid / collagen
-- collections even though some qualify on ingredients. Those pages' copy is
-- about serums and creams; a shampoo in them would read as padding. Revisit
-- if the hair range grows enough to deserve its own ingredient pages.

begin;

insert into public.products
  (slug, brand, name, price, category, subcategory, status, kind, stock_mode,
   track_inventory, stock, continue_selling_when_out, packaging, weight_grams,
   short_description, description, how_to_use, ingredients,
   key_benefits, faq, seo_title, seo_description)
values

-- ── CeraVe ────────────────────────────────────────────────────────────────
( 'cerave-anti-dandruff-hydrating-shampoo', 'CeraVe',
  'CeraVe Anti-Dandruff Hydrating Shampoo 236ml',
  6500, 'Hair Care', 'Shampoo', 'draft', 'simple', 'external', false, 0, true, 'standard', 236,
  'Anti-dandruff shampoo with 1% pyrithione zinc, ceramides, niacinamide and hyaluronic acid. Clears flakes without leaving the scalp dry and tight.',
  E'Most anti-dandruff shampoos work by stripping the scalp, which clears the flakes and then leaves you itchy and dry enough to flake again. This one treats the dandruff and looks after the skin at the same time.\n\nThe active is 1% pyrithione zinc, the standard over-the-counter anti-dandruff ingredient. What CeraVe adds around it is the same barrier support that goes into their face products: three ceramides, niacinamide to calm irritation, and hyaluronic acid to hold water in the scalp.\n\nIt is sulfate free, fragrance free and safe on colour-treated hair. Developed with dermatologists.',
  E'Use on wet hair two or three times a week. Massage into the SCALP rather than the lengths, which is where dandruff actually lives, and leave it for two to three minutes before rinsing so the pyrithione zinc has time to work. On the other days use a regular shampoo.',
  'Aqua/Water, Sodium Cocoyl Isethionate, Cocamidopropyl Betaine, Glycerin, Pyrithione Zinc 1%, Niacinamide, Sodium Hyaluronate, Ceramide NP, Ceramide AP, Ceramide EOP, Phytosphingosine, Cholesterol, Citric Acid, Sodium Chloride, Sodium Benzoate.',
  '[{"icon":"shield","text":"1% pyrithione zinc clears flakes"},{"icon":"droplet","text":"Ceramides and hyaluronic acid keep the scalp hydrated"},{"icon":"flower","text":"Fragrance free, for sensitive scalps"},{"icon":"sparkle","text":"Safe on colour-treated hair"}]'::jsonb,
  '[{"q":"How often should I use it?","a":"Two or three times a week, alternating with your normal shampoo. Daily use is not needed and can dry the scalp out."},
    {"q":"Will it dry my hair like other dandruff shampoos?","a":"That is the problem it was built to solve. The ceramides and hyaluronic acid replace what a medicated wash usually strips, which is why it can be used long term."},
    {"q":"Is it safe for coloured or keratin-treated hair?","a":"Yes. It is sulfate free, which is what usually strips colour and keratin treatments."},
    {"q":"How long before the flakes go?","a":"Most people see a clear difference within two to three weeks of consistent use. If nothing has changed after a month, the cause may not be ordinary dandruff and is worth showing a dermatologist."}]'::jsonb,
  'CeraVe Anti-Dandruff Shampoo in Pakistan',
  'CeraVe Anti-Dandruff Hydrating Shampoo with 1% pyrithione zinc, ceramides and niacinamide. Clears flakes without drying the scalp. Authentic CeraVe, COD across Pakistan.'),

( 'cerave-anti-dandruff-hydrating-conditioner', 'CeraVe',
  'CeraVe Anti-Dandruff Hydrating Conditioner 236ml',
  6500, 'Hair Care', 'Conditioner', 'draft', 'simple', 'external', false, 0, true, 'standard', 236,
  'The conditioner made to pair with the anti-dandruff shampoo. Ceramides and hyaluronic acid, no sulfates, safe for daily use on a treated scalp.',
  E'A medicated shampoo does the work on the scalp and tends to leave the lengths rough. This is the matching conditioner, built on the same ceramide and hyaluronic acid base so it does not undo the treatment.\n\nUsed together with the anti-dandruff shampoo, CeraVe reports removal of up to 100% of visible flakes. Used on its own it is simply a good, fragrance-free conditioner for a sensitive scalp.\n\nSulfate free, and safe on colour-treated hair.',
  E'After shampooing, work through the mid-lengths and ends, leave for one to two minutes, then rinse. Keep it off the scalp itself if your roots get oily quickly.',
  'Aqua/Water, Glycerin, Behentrimonium Chloride, Cetearyl Alcohol, Niacinamide, Sodium Hyaluronate, Ceramide NP, Ceramide AP, Ceramide EOP, Phytosphingosine, Cholesterol, Panthenol, Citric Acid, Sodium Benzoate.',
  '[{"icon":"droplet","text":"Restores softness after a medicated wash"},{"icon":"shield","text":"Three ceramides support the scalp barrier"},{"icon":"flower","text":"Fragrance free and sulfate free"},{"icon":"sparkle","text":"Pairs with the anti-dandruff shampoo"}]'::jsonb,
  '[{"q":"Do I need this if I already use the shampoo?","a":"Not strictly, but the pair is what the clinical claim of removing up to 100% of visible flakes is based on, and a medicated shampoo alone can leave the lengths dry."},
    {"q":"Can I use it every day?","a":"Yes. Unlike the shampoo, there is no active to space out."},
    {"q":"Should it go on the scalp?","a":"Mid-lengths and ends is enough. On an oily scalp, conditioner at the roots makes hair look greasy faster."}]'::jsonb,
  'CeraVe Anti-Dandruff Conditioner in Pakistan',
  'CeraVe Anti-Dandruff Hydrating Conditioner with ceramides and hyaluronic acid. Pairs with the anti-dandruff shampoo. Authentic CeraVe, COD across Pakistan.'),

-- ── OGX ───────────────────────────────────────────────────────────────────
( 'ogx-argan-oil-of-morocco-shampoo', 'OGX',
  'OGX Renewing + Argan Oil of Morocco Shampoo 385ml',
  2250, 'Hair Care', 'Shampoo', 'draft', 'simple', 'external', false, 0, true, 'standard', 385,
  'Sulfate-free shampoo with cold-pressed argan oil. The wash that goes with the Argan Oil of Morocco hair mask already on the shelf.',
  E'A sulfate-free shampoo built around cold-pressed argan oil, for hair that has gone dull, dry or frizzy. Sulfate free matters here for a practical reason rather than a marketing one: sulfates are what strip colour and undo keratin treatments fastest.\n\nThis is the first step of the same range as the Argan Oil of Morocco hair mask, so the three products are designed to be used together.',
  E'Massage into wet hair, lather, and rinse thoroughly. Follow with the matching conditioner. Use the hair mask once or twice a week in place of the conditioner for a deeper treatment.',
  'Water/Aqua, Sodium Lauroyl Methyl Isethionate, Cocamidopropyl Hydroxysultaine, Glycerin, Argania Spinosa (Argan) Kernel Oil, Hydrolyzed Wheat Protein, Panthenol, Citric Acid, Sodium Benzoate, Fragrance/Parfum.',
  '[{"icon":"leaf","text":"Sulfate free, safe on colour"},{"icon":"droplet","text":"Cold-pressed argan oil for shine"},{"icon":"sparkle","text":"Smooths frizz and flyaways"},{"icon":"bottle","text":"385ml, lasts a household weeks"}]'::jsonb,
  '[{"q":"Is it really sulfate free?","a":"Yes. It cleanses with sodium lauroyl methyl isethionate instead, which is gentler on colour and on keratin treatments."},
    {"q":"Will it weigh fine hair down?","a":"Used with the conditioner on the lengths only, no. If your hair is very fine, skip the mask and use the conditioner alone."},
    {"q":"Does it work with the hair mask you already sell?","a":"Yes, it is the same Argan Oil of Morocco range. Shampoo, condition, and use the mask once or twice a week instead of the conditioner."}]'::jsonb,
  'OGX Argan Oil of Morocco Shampoo in Pakistan',
  'OGX Renewing + Argan Oil of Morocco sulfate-free shampoo 385ml. Smooths frizz, safe on colour-treated hair. Authentic OGX, COD across Pakistan.'),

( 'ogx-argan-oil-of-morocco-conditioner', 'OGX',
  'OGX Renewing + Argan Oil of Morocco Conditioner 385ml',
  2250, 'Hair Care', 'Conditioner', 'draft', 'simple', 'external', false, 0, true, 'standard', 385,
  'The matching conditioner for the Argan Oil of Morocco range. Detangles and smooths without the heaviness of an oil.',
  E'The everyday counterpart to the Argan Oil of Morocco mask: lighter, for daily use, and enough on its own between deep-treatment days.\n\nCold-pressed argan oil smooths the cuticle, which is what makes hair look glossy rather than merely clean, and makes wet hair far easier to comb without snapping it.',
  E'After shampooing, work through the mid-lengths and ends and leave for one to two minutes before rinsing. Swap it for the Argan Oil of Morocco hair mask once or twice a week if your hair is very dry or damaged.',
  'Water/Aqua, Cetearyl Alcohol, Behentrimonium Chloride, Glycerin, Argania Spinosa (Argan) Kernel Oil, Hydrolyzed Wheat Protein, Panthenol, Citric Acid, Sodium Benzoate, Fragrance/Parfum.',
  '[{"icon":"droplet","text":"Detangles without heaviness"},{"icon":"sparkle","text":"Cuticle-smoothing shine"},{"icon":"leaf","text":"Cold-pressed argan oil"},{"icon":"bottle","text":"Matches the shampoo and mask"}]'::jsonb,
  '[{"q":"Conditioner or the hair mask?","a":"Conditioner for everyday, mask once or twice a week. The mask is richer and sits on the hair longer."},
    {"q":"How long should I leave it in?","a":"One to two minutes is enough. Longer does not add much, because a rinse-out conditioner does most of its work on contact."},
    {"q":"Is it heavy on fine hair?","a":"Keep it to the mid-lengths and ends and it is not. Conditioner at the roots is what makes fine hair look flat."}]'::jsonb,
  'OGX Argan Oil of Morocco Conditioner in Pakistan',
  'OGX Renewing + Argan Oil of Morocco Conditioner 385ml. Detangles and adds shine, pairs with the shampoo and hair mask. Authentic OGX, COD across Pakistan.'),

( 'ogx-biotin-collagen-shampoo', 'OGX',
  'OGX Thick & Full + Biotin & Collagen Shampoo 385ml',
  2450, 'Hair Care', 'Shampoo', 'draft', 'simple', 'external', false, 0, true, 'standard', 385,
  'Volumising shampoo with biotin, collagen and wheat protein. For fine or limp hair that needs body rather than moisture.',
  E'Fine hair usually has the opposite problem to dry hair: it does not need more oil, it needs the strands to feel thicker and hold their shape.\n\nThis works by coating each strand with hydrolysed wheat protein, biotin and collagen, so hair feels fuller and lifts at the root. It is a cosmetic thickening effect rather than new growth, and it washes out, which is exactly what you want from a shampoo. For actual density, a leave-on treatment is the tool.',
  E'Massage into wet hair, lather and rinse. Follow with the matching conditioner on the mid-lengths and ends only, keeping it off the roots so the volume is not flattened.',
  'Water/Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Glycerin, Hydrolyzed Wheat Protein, Hydrolyzed Collagen, Biotin, Vitamin B5 (Panthenol), Citric Acid, Sodium Benzoate, Fragrance/Parfum.',
  '[{"icon":"bolt","text":"Thickens fine, limp hair"},{"icon":"dna","text":"Biotin and hydrolysed collagen"},{"icon":"sparkle","text":"Adds body and root lift"},{"icon":"bottle","text":"385ml salon-size bottle"}]'::jsonb,
  '[{"q":"Will this regrow hair?","a":"No, and anything claiming a shampoo does is overselling. It makes existing strands feel and look thicker. For density, use a leave-on treatment like a peptide hair serum or minoxidil."},
    {"q":"Is it sulfate free?","a":"No, this one uses sodium laureth sulfate. If you need sulfate free, the Argan Oil of Morocco shampoo in the same brand is the one to choose."},
    {"q":"Can I use it every day?","a":"Yes, though most people do not need to wash daily. Two or three times a week suits most hair types in Pakistani weather."}]'::jsonb,
  'OGX Biotin & Collagen Shampoo in Pakistan',
  'OGX Thick & Full + Biotin & Collagen Shampoo 385ml for fine, limp hair. Adds body and root lift. Authentic OGX, COD across Pakistan.'),

( 'ogx-biotin-collagen-conditioner', 'OGX',
  'OGX Thick & Full + Biotin & Collagen Conditioner 385ml',
  2450, 'Hair Care', 'Conditioner', 'draft', 'simple', 'external', false, 0, true, 'standard', 385,
  'The volumising conditioner to match. Softens without flattening, which is the hard part on fine hair.',
  E'The usual trade-off on fine hair is that anything which softens it also flattens it. This is formulated lighter than a standard conditioner for exactly that reason, with the same biotin, collagen and wheat protein as the shampoo.\n\nKeep it off the roots and it detangles without costing you the volume the shampoo just built.',
  E'After shampooing, apply to the mid-lengths and ends only. Leave for one minute, then rinse well. Avoid the roots.',
  'Water/Aqua, Cetearyl Alcohol, Behentrimonium Chloride, Glycerin, Hydrolyzed Wheat Protein, Hydrolyzed Collagen, Biotin, Panthenol, Citric Acid, Sodium Benzoate, Fragrance/Parfum.',
  '[{"icon":"bolt","text":"Conditions without flattening"},{"icon":"dna","text":"Biotin and collagen complex"},{"icon":"droplet","text":"Detangles fine hair"},{"icon":"bottle","text":"Matches the Thick & Full shampoo"}]'::jsonb,
  '[{"q":"Why keep it off the roots?","a":"Conditioner at the root weighs fine hair down and undoes the lift. Mid-lengths and ends is where the tangles and dryness actually are."},
    {"q":"Is one minute really enough?","a":"Yes. A rinse-out conditioner does most of its work on contact; leaving it longer mainly wastes product."},
    {"q":"Can I use it with a different shampoo?","a":"Yes. It is formulated to pair with the Thick & Full shampoo but works on its own."}]'::jsonb,
  'OGX Biotin & Collagen Conditioner in Pakistan',
  'OGX Thick & Full + Biotin & Collagen Conditioner 385ml. Softens fine hair without weighing it down. Authentic OGX, COD across Pakistan.'),

( 'ogx-tea-tree-mint-shampoo', 'OGX',
  'OGX Hydrating + Tea Tree Mint Shampoo 385ml',
  2450, 'Hair Care', 'Shampoo', 'draft', 'simple', 'external', false, 0, true, 'standard', 385,
  'Tea tree oil and peppermint for an itchy or flaky scalp, with the cooling tingle that makes it obvious it is working.',
  E'For a scalp that itches, flakes lightly or just feels congested after a week of dust and heat. Tea tree oil and peppermint clean the scalp properly, and the menthol tingle is genuinely cooling in Karachi or Lahore summer.\n\nA point worth being straight about: this is a scalp-care shampoo, not a medicated one. Persistent dandruff needs an active like pyrithione zinc or ketoconazole. Use this for comfort and mild flaking, and the CeraVe or La Roche-Posay anti-dandruff shampoos for the real thing.',
  E'Massage into the wet SCALP, not just the hair, and let the tingle sit for a minute before rinsing. Use two or three times a week, or whenever the scalp feels congested.',
  'Water/Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Glycerin, Melaleuca Alternifolia (Tea Tree) Leaf Oil, Mentha Piperita (Peppermint) Oil, Menthol, Panthenol, Citric Acid, Sodium Benzoate, Fragrance/Parfum.',
  '[{"icon":"leaf","text":"Tea tree oil for a congested scalp"},{"icon":"flame","text":"Cooling peppermint tingle"},{"icon":"droplet","text":"Cleans without over-drying"},{"icon":"bottle","text":"385ml salon-size bottle"}]'::jsonb,
  '[{"q":"Is this an anti-dandruff shampoo?","a":"Not a medicated one. It helps mild flaking and itch, but persistent dandruff needs an active such as pyrithione zinc. The CeraVe anti-dandruff shampoo is the one for that."},
    {"q":"Is the tingle normal?","a":"Yes, that is the menthol. It should feel cool, not burning. If it stings, rinse it out and stop using it."},
    {"q":"Can I use it on colour-treated hair?","a":"It contains sulfates, which fade colour faster. If your hair is coloured, the Argan Oil of Morocco shampoo is the better pick."}]'::jsonb,
  'OGX Tea Tree Mint Shampoo in Pakistan',
  'OGX Hydrating + Tea Tree Mint Shampoo 385ml for itchy, flaky scalps. Cooling peppermint and tea tree oil. Authentic OGX, COD across Pakistan.'),

-- ── The Ordinary ──────────────────────────────────────────────────────────
( 'the-ordinary-multi-peptide-hair-density-serum', 'The Ordinary',
  'The Ordinary Multi-Peptide Serum for Hair Density 60ml',
  8000, 'Hair Care', 'Hair Serum', 'draft', 'simple', 'external', false, 0, true, 'standard', 60,
  'A leave-in scalp serum with REDENSYL, Procapil, CAPIXYL, BAICAPIL, AnaGain and caffeine. The non-medicated route to thicker-looking hair.',
  E'A leave-in serum for the scalp rather than the hair, aimed at density: thicker-looking, fuller hair over months rather than days.\n\nIt stacks six studied complexes in one bottle, which is why it costs what it does: REDENSYL, Procapil, CAPIXYL, BAICAPIL, AnaGain and high-solubility caffeine.\n\nHonestly about what it is not: this is not minoxidil. Minoxidil is a licensed medicine with the strongest evidence for regrowth, and we stock it. This is the non-medicated option for people who would rather not use a drug, or who want something to pair with one. Give it a minimum of three months.',
  E'Apply to a dry or towel-dried SCALP once a day, parting the hair and working along the partings rather than over the top of the hair. Massage in. Do not rinse out. Wash your hands afterwards. Give it three to six months before judging it.',
  'Aqua (Water), Glycerin, Caffeine, Larix Europaea Wood Extract, Glycine Soja (Soybean) Germ Extract, Triticum Vulgare (Wheat) Germ Extract, Acetyl Tetrapeptide-3, Trifolium Pratense (Clover) Flower Extract, Butylene Glycol, Biotinoyl Tripeptide-1, Apigenin, Oleanolic Acid, Panthenol, Pisum Sativum (Pea) Sprout Extract, Zinc Chloride, Phenoxyethanol, Chlorphenesin.',
  '[{"icon":"dna","text":"Six peptide and botanical complexes"},{"icon":"bolt","text":"High-solubility caffeine"},{"icon":"leaf","text":"Non-medicated, no minoxidil"},{"icon":"pulse","text":"Targets density, not just shine"}]'::jsonb,
  '[{"q":"Is this better than minoxidil?","a":"No. Minoxidil is a licensed medicine with far stronger evidence for regrowth. This is the non-medicated alternative, and some people use both, the serum in the morning and minoxidil at night."},
    {"q":"How long before I see anything?","a":"Three months at minimum, six to judge it properly. Hair grows roughly a centimetre a month, so nothing meaningful can show sooner."},
    {"q":"Will it make my hair greasy?","a":"It is water based and lightweight, so no. Apply along the partings on the scalp, not through the lengths."},
    {"q":"Can I use it if I am pregnant?","a":"Ask your doctor. It is not a medicine, but peptide and caffeine products in pregnancy are a question for someone who knows your case."}]'::jsonb,
  'The Ordinary Hair Density Serum in Pakistan',
  'The Ordinary Multi-Peptide Serum for Hair Density 60ml with REDENSYL, Procapil and caffeine. Non-medicated hair density support. COD across Pakistan.'),

-- ── La Roche-Posay ────────────────────────────────────────────────────────
( 'la-roche-posay-kerium-ds-anti-dandruff-shampoo', 'La Roche-Posay',
  'La Roche-Posay Kerium DS Anti-Dandruff Intensive Shampoo 125ml',
  6900, 'Hair Care', 'Shampoo', 'draft', 'simple', 'external', false, 0, true, 'standard', 125,
  'An intensive dermatological anti-dandruff treatment for stubborn flaking, with pyrithione zinc, salicylic acid and LRP thermal spring water.',
  E'The step up from an everyday anti-dandruff shampoo, for flaking that has not responded to one. It is an intensive course rather than a permanent shampoo.\n\nTwo actives instead of one: pyrithione zinc to deal with the yeast behind most dandruff, and salicylic acid to lift the scale that is already stuck to the scalp. La Roche-Posay thermal spring water sits underneath both to keep a treated scalp from getting raw.\n\nUse it as a two to four week course, then move to a gentler anti-dandruff shampoo for maintenance.',
  E'Use twice a week for the first two to four weeks. Massage into a wet scalp, leave for two to three minutes, then rinse thoroughly. After the course, drop to once a week or switch to a maintenance shampoo. Avoid the eyes.',
  'Aqua/Water, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Glycol Distearate, Pyrithione Zinc, Salicylic Acid, Aqua/La Roche-Posay Prebiotic Thermal Water, Glycerin, Sodium Chloride, Citric Acid, Sodium Benzoate, Parfum/Fragrance.',
  '[{"icon":"shield","text":"Pyrithione zinc plus salicylic acid"},{"icon":"droplet","text":"LRP thermal spring water soothes"},{"icon":"pulse","text":"For stubborn, persistent flaking"},{"icon":"flower","text":"Dermatologist-developed formula"}]'::jsonb,
  '[{"q":"How is this different from the CeraVe anti-dandruff shampoo?","a":"CeraVe is the gentle everyday option you can use long term. This is the intensive one for a two to four week course when flaking has not cleared. Many people run this course and then maintain with CeraVe."},
    {"q":"Can I use it forever?","a":"It is not meant for that. Use it for a few weeks, then move to a maintenance shampoo. Continuous use of a strong medicated wash tends to irritate the scalp."},
    {"q":"My flaking is greasy and yellow. Is that dandruff?","a":"That can be seborrhoeic dermatitis, which is what the DS in the name refers to and what this shampoo is designed for. If it spreads to the face or does not settle, see a dermatologist."},
    {"q":"Is it safe on coloured hair?","a":"It contains sulfates, so it will fade colour faster than a sulfate-free wash. During a short course that is usually an acceptable trade."}]'::jsonb,
  'La Roche-Posay Kerium DS Shampoo in Pakistan',
  'La Roche-Posay Kerium DS Intensive Anti-Dandruff Shampoo 125ml with pyrithione zinc and salicylic acid. For stubborn flaking. COD across Pakistan.'),

-- ── Olaplex (new brand, trending) ─────────────────────────────────────────
( 'olaplex-no-3-hair-perfector', 'Olaplex',
  'Olaplex No.3 Hair Perfector 100ml',
  10200, 'Hair Care', 'Hair Treatment', 'draft', 'simple', 'external', false, 0, true, 'standard', 100,
  'The at-home bond-repair treatment for bleached, coloured or heat-damaged hair. Used before shampoo, not after.',
  E'The treatment that made bond repair a category. It works on the broken disulphide bonds inside the hair shaft, which is the damage bleaching, colouring and straightening actually cause, rather than coating the outside to make damage look better temporarily.\n\nThat distinction matters for what you should expect: a conditioner smooths, this one rebuilds. It is the product to reach for if your hair has gone brittle or gummy after colour or keratin work.\n\nOne thing almost everyone gets wrong on the first try: No.3 is not a conditioner and does not go on after shampoo. It goes on dirty, damp hair BEFORE you wash.',
  E'On damp, unwashed hair, apply generously from mid-length to ends and comb through. Leave for at least 10 minutes, longer if hair is badly damaged. Then shampoo and condition as normal. Use once a week.',
  'Water/Aqua, Bis-Aminopropyl Diglycol Dimaleate, Cetearyl Alcohol, Behentrimonium Methosulfate, Cetyl Alcohol, Glycerin, Propylene Glycol, Phenoxyethanol, Sodium Benzoate, Fragrance/Parfum.',
  '[{"icon":"shield","text":"Repairs broken bonds, not just the surface"},{"icon":"sparkle","text":"For bleached and colour-treated hair"},{"icon":"pulse","text":"Weekly 10-minute treatment"},{"icon":"bottle","text":"100ml, around 10 to 12 uses"}]'::jsonb,
  '[{"q":"Do I use it instead of conditioner?","a":"No, and this is the most common mistake. It goes on damp, unwashed hair before shampooing, then you shampoo and condition afterwards as normal."},
    {"q":"Can I leave it on overnight?","a":"Yes, plenty of people do for very damaged hair. Ten minutes is the minimum, and longer does no harm."},
    {"q":"Is it worth it if my hair is not bleached?","a":"Less so. It repairs bond damage, which comes mainly from bleach, permanent colour, keratin treatments and heavy heat styling. On healthy virgin hair you will notice little."},
    {"q":"How long does one bottle last?","a":"Around 10 to 12 weekly treatments for mid-length hair, less if your hair is long or thick."}]'::jsonb,
  'Olaplex No.3 Hair Perfector in Pakistan',
  'Olaplex No.3 Hair Perfector 100ml, at-home bond repair for bleached and colour-treated hair. Authentic Olaplex, COD across Pakistan.');

commit;
