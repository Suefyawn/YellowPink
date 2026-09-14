-- Shopping-intent collections, batch 3: INGREDIENT pages.
--
-- Batches 1 and 2 covered product FORMATS (sunscreens, cleansers, toners).
-- This batch covers what people actually type when they know the ingredient
-- but not the product, which in the pk database is where the volume is:
--
--   salicylic acid       14,800/mo   6 products
--   niacinamide serum    12,100/mo   13 products  (+ "niacinamide" 8,100)
--   collagen supplement   6,600/mo   7 products
--   hyaluronic acid serum 5,400/mo   8 products
--   foundation makeup     1,600/mo   5 products
--   vitamin c (blended)               6 products
--
-- ── Why tags rather than title rules ───────────────────────────────────────
-- The smart-rule engine can only match a product's NAME, not its
-- description (src/lib/collections.ts). Ingredients are mostly in the
-- description: only 3 products have "niacinamide" in the name, but 13 are
-- built around it. A title rule would have shipped a 3-product page for a
-- 12,100/mo keyword.
--
-- So membership goes through product_tags / product_tag_map, which the rule
-- engine already understands ({"field":"tag","op":"in"}). Three things fall
-- out of that, all of them wanted:
--
--   1. It is the Shopify pattern — product tags feeding automated collection
--      conditions — which AGENTS.md asks admin surfaces to follow.
--   2. Staff can add a tag to a new product from the product page's Tags box
--      and it joins the collection with no migration and no code change.
--   3. Tags already power the storefront's Tags FACET (lib/shop-facets.ts),
--      so tagging these also gives shoppers ingredient filtering on /shop for
--      free. That was on the owner's list as "this could be a filter too".
--
-- ── Why membership is listed by slug, not matched by pattern ───────────────
-- Because pattern matching was tried and it is wrong. An ILIKE '%mask%'
-- pulls a HAIR mask into face masks; '%vitamin c%' pulls in a lip liner and
-- two iron supplements; '%hyaluronic%' pulls in a joint tablet and a blush.
-- Every list below is curated, so the pages contain what the shopper came
-- for.
--
-- ── Deferred again, for stock rather than demand ───────────────────────────
--   concealer  6,600/mo — 6 matches, but 2 are a powder and a brush set, so
--                         4 real concealers. Batch 2 deferred it at 4 too.
--   face mask  4,400/mo — 5 matches, one of which is a hair mask. 4 real.
--   multivitamin 8,100/mo — 7 matches, but 3 are fertility packs. 4 real.
-- All three are the next to build the moment those shelves are deeper.

begin;

-- ── 1. Ingredient tags ──────────────────────────────────────────────────────
insert into public.product_tags (slug, name) values
  ('niacinamide',      'Niacinamide'),
  ('salicylic-acid',   'Salicylic Acid'),
  ('hyaluronic-acid',  'Hyaluronic Acid'),
  ('vitamin-c',        'Vitamin C'),
  ('collagen',         'Collagen'),
  ('foundation',       'Foundation')
on conflict (slug) do nothing;

-- ── 2. Membership, curated by product slug ─────────────────────────────────
-- Joins on slug so a re-run is idempotent and a renamed product fails loudly
-- (no row inserted) rather than silently tagging the wrong thing.
insert into public.product_tag_map (product_id, tag_id)
select p.id, t.id
from (values
  -- Salicylic acid / BHA
  ('salicylic-acid', 'st-ives-bha-green-tea-bamboo-face-scrub'),
  ('salicylic-acid', 'st-ives-bha-apricot-face-scrub'),
  ('salicylic-acid', 'salicylic-acid-serum'),
  ('salicylic-acid', 'la-roche-posay-effaclar-duo-m'),
  ('salicylic-acid', 'cerave-acne-control-cleanser'),
  ('salicylic-acid', 'cerave-sunscreen-and-cleanser-bundle'),
  -- Niacinamide. The Glow Recipe niacinamide BLUSH is deliberately absent:
  -- someone searching the ingredient wants skincare, not a cheek tint.
  ('niacinamide', 'anua-niacinamide-10-txa-4-serum'),
  ('niacinamide', 'medicube-txa-niacinamide-capsule-cream'),
  ('niacinamide', 'axis-y-dark-spot-correcting-glow-serum'),
  ('niacinamide', 'medicube-pdrn-pink-peptide-serum'),
  ('niacinamide', 'skin1004-madagascar-centella-tone-up-sunscreen'),
  ('niacinamide', 'celimax-pore-dark-spot-brightening-care-sunscreen'),
  ('niacinamide', 'cerave-fluide-invisible-toucher-sec-spf50'),
  ('niacinamide', 'medicube-kojic-acid-turmeric-brightening-gel-mask'),
  ('niacinamide', 'centella-tone-brightening-capsule-ampoule-100-ml'),
  ('niacinamide', 'medicube-kojic-acid-turmeric-vita-capsule-cream'),
  ('niacinamide', 'la-roche-posay-effaclar-duo-m'),
  ('niacinamide', 'cerave-acne-control-cleanser'),
  ('niacinamide', 'la-roche-posay-toleriane-hydrating-gentle-cleanser'),
  -- Hyaluronic acid. The joint tablet and the blush that both list it are
  -- excluded; neither is what "hyaluronic acid serum" means.
  ('hyaluronic-acid', 'hyaluronic-acid-serum'),
  ('hyaluronic-acid', 'anua-azelaic-10-hyaluron-redness-soothing-serum'),
  ('hyaluronic-acid', 'cerave-hydrating-facial-cleanser'),
  ('hyaluronic-acid', 'cerave-moisturizing-cream-340-grams'),
  ('hyaluronic-acid', 'cerave-moisturizing-lotion'),
  ('hyaluronic-acid', 'cerave-sheer-tint-sunscreen-spf30'),
  ('hyaluronic-acid', 'cerave-hydrating-cleanser-and-moisturizing-cream-bundle'),
  ('hyaluronic-acid', 'sheet-mask'),
  -- Vitamin C. Iron tablets that merely contain vitamin C are excluded.
  ('vitamin-c', 'vitamin-c-serum'),
  ('vitamin-c', 'cee'),
  ('vitamin-c', 'asco-c'),
  ('vitamin-c', 'gluthic-cee'),
  ('vitamin-c', 'beauty-from-within-glow'),
  ('vitamin-c', 'immunity-detox-shield-combo-total-body-defense-bundle'),
  -- Collagen
  ('collagen', 'nutrifactor-nutri-collagen'),
  ('collagen', 'nutrifactor-collagatin-powder'),
  ('collagen', 'collagen-peptides-powder'),
  ('collagen', 'beauty-from-within-glow'),
  ('collagen', 'medicube-collagen-jelly-cream'),
  ('collagen', 'st-ives-collagen-face-moisturizer'),
  ('collagen', 'st-ives-collagen-elastin-lotion'),
  -- Foundation. The baked powder, the brush set and the highlighter drops
  -- all matched on '%foundation%' and are all excluded.
  ('foundation', 'kiko-milano-unlimited-foundation-5-5-gold'),
  ('foundation', 'nars-light-reflecting-foundation'),
  ('foundation', 'charlotte-tilbury-beautiful-skin-foundation'),
  ('foundation', 'charlotte-tilbury-airbrush-flawless-foundation'),
  ('foundation', 'huda-beauty-easy-blur-foundation')
) as v(tag_slug, product_slug)
join public.product_tags t on t.slug = v.tag_slug
join public.products     p on p.slug = v.product_slug
on conflict do nothing;

-- ── 3. The collection pages ────────────────────────────────────────────────
insert into public.collections
  (slug, title, description, type, rules, status, sort_order, seo_title, seo_description, content_html, faqs)
values

( 'salicylic-acid',
  'Salicylic Acid & BHA',
  'Salicylic acid cleansers, scrubs and a 2% solution, from PKR 910 up. The ingredient to reach for when the problem is blackheads and clogged pores rather than dryness.',
  'smart',
  '{"match":"any","conditions":[{"field":"tag","op":"in","value":["salicylic-acid"]}]}'::jsonb,
  'published', 112,
  'Salicylic Acid in Pakistan: Prices & How to Use It',
  'Salicylic acid and BHA products available in Pakistan: cleansers, face scrubs and The Ordinary 2% solution. What strength to start on, live prices, cash on delivery.',
  $html$
<h2>What salicylic acid actually does</h2>
<p>It is oil-soluble, which is the whole point. Most exfoliating acids work on the surface; salicylic acid dissolves into the oil inside a pore and clears it from the inside. That is why it is the standard answer for blackheads and the small bumpy congestion across the nose and forehead, and why it does very little for dry, flaky skin.</p>
<h3>Starting out</h3>
<p>A wash-off product is the gentler way in, because the contact time is short. The BHA Green Tea &amp; Bamboo Face Scrub ([[price:st-ives-bha-green-tea-bamboo-face-scrub]]) and the Apricot version ([[price:st-ives-bha-apricot-face-scrub]]) are the cheapest place to start, at around a tenth of what a serum costs.</p>
<h3>Leave-on strength</h3>
<p>The Ordinary Salicylic Acid 2% Solution ([[price:salicylic-acid-serum]]) is the standard 2%, which is as high as it usefully goes on skin. Two or three nights a week is plenty at first. Every night, from day one, is how people end up with a stinging, peeling face and decide the ingredient does not suit them.</p>
<h3>If it is full acne, not congestion</h3>
<p>The CeraVe Acne Control Cleanser ([[price:cerave-acne-control-cleanser]]) pairs salicylic acid with a barrier-friendly base, and Effaclar Duo+M ([[price:la-roche-posay-effaclar-duo-m]]) is the moisturiser built to sit on top of it without undoing the work.</p>
<h3>The part people skip</h3>
<p>Salicylic acid makes skin more sun-sensitive, and Pakistani sun is not forgiving. Daily SPF is not optional alongside it. The cleanser and sunscreen bundle ([[price:cerave-sunscreen-and-cleanser-bundle]]) covers both ends.</p>
<h3>What it will not fix</h3>
<p>Hormonal cystic acne along the jaw usually needs a doctor, not a stronger acid. If three months of consistent use has changed nothing, that is the signal to see a dermatologist rather than to increase the dose.</p>
$html$,
  '[{"q":"Salicylic acid or benzoyl peroxide?","a":"Salicylic acid for blackheads, whiteheads and clogged pores. Benzoyl peroxide for inflamed, red, pus-filled spots, because it kills the bacteria involved. Plenty of people need both, used at different times of day."},
    {"q":"How often should I use it?","a":"Start at two or three times a week and build up only if your skin is comfortable. Daily use suits oily skin; dry or sensitive skin often does better staying at two or three."},
    {"q":"Can I use salicylic acid with niacinamide or vitamin C?","a":"With niacinamide, yes, they pair well. With a strong vitamin C, use them at opposite ends of the day rather than layering, to avoid irritation."},
    {"q":"Is it safe in pregnancy?","a":"Wash-off products at low strength are generally considered fine, but leave-on salicylic acid is one to ask your doctor about. Advice differs, so get it from someone who knows your pregnancy."}]'::jsonb),

( 'niacinamide',
  'Niacinamide',
  'Niacinamide serums, creams and sunscreens, including Anua 10% + TXA and the Medicube capsule cream. The most useful ingredient in Pakistani skincare for dark spots and oil control.',
  'smart',
  '{"match":"any","conditions":[{"field":"tag","op":"in","value":["niacinamide"]}]}'::jsonb,
  'published', 113,
  'Niacinamide Serum in Pakistan: Prices & Picks',
  'Niacinamide serums, moisturisers and sunscreens available in Pakistan, from Anua, Medicube, CeraVe, Axis-Y and La Roche-Posay. What percentage to use, live prices, cash on delivery.',
  $html$
<h2>Why niacinamide is worth the shelf space</h2>
<p>It does several things at once, which is unusual. It fades post-acne marks, calms redness, reduces how much oil the skin produces, and strengthens the barrier so other actives sting less. It is also one of the few actives almost nobody reacts badly to, which is why it turns up in cleansers, serums, moisturisers and sunscreens alike.</p>
<h3>For dark spots and melasma</h3>
<p>Anua Niacinamide 10% + TXA 4% ([[price:anua-niacinamide-10-txa-4-serum]]) is the strongest combination here, because tranexamic acid works on pigment by a different route than niacinamide does. The Medicube TXA + Niacinamide Capsule Cream ([[price:medicube-txa-niacinamide-capsule-cream]]) is the same pairing in a moisturiser, if you would rather not add a step.</p>
<h3>For post-acne marks</h3>
<p>Axis-Y Dark Spot Correcting Glow Serum ([[price:axis-y-dark-spot-correcting-glow-serum]]) is the gentler daily option, and it sits well under sunscreen.</p>
<h3>If your skin is reactive</h3>
<p>Start at 5% rather than 10%. Higher is not better with this one: above about 10% some people get flushing, and the extra percentage buys very little. The Toleriane Hydrating Cleanser ([[price:la-roche-posay-toleriane-hydrating-gentle-cleanser]]) is a low-commitment way to introduce it, since it rinses off.</p>
<h3>Niacinamide in your sunscreen</h3>
<p>Pigmentation work is undone by sun faster than any serum can repair it, so a sunscreen that also carries niacinamide is doing two jobs. SKIN1004 Tone-Up ([[price:skin1004-madagascar-centella-tone-up-sunscreen]]), Celimax Pore + Dark Spot ([[price:celimax-pore-dark-spot-brightening-care-sunscreen]]) and the CeraVe fluid ([[price:cerave-fluide-invisible-toucher-sec-spf50]]) all do.</p>
<h3>How long before it shows</h3>
<p>Oil control inside two weeks. Dark spots take eight to twelve weeks, and only with daily sunscreen. Anyone promising faster than that on pigmentation is selling something.</p>
$html$,
  '[{"q":"What percentage of niacinamide should I use?","a":"5% suits most people and 10% is the practical ceiling. Higher percentages cause flushing in some people and do not work better, so there is no reason to chase them."},
    {"q":"Can I use niacinamide with vitamin C?","a":"Yes. The old warning about the two cancelling each other out came from a study using unstable raw forms at high heat, not from finished products. Millions of people use both daily without a problem."},
    {"q":"Does niacinamide help with open pores?","a":"It reduces oil output, which makes pores look smaller. It cannot change the actual size of a pore, and no topical product can, so treat before-and-after photos claiming otherwise with suspicion."},
    {"q":"Morning or night?","a":"Either, and both is fine. It is stable and does not make skin sun-sensitive, which is why it also appears in sunscreens."}]'::jsonb),

( 'hyaluronic-acid',
  'Hyaluronic Acid',
  'Hyaluronic acid serums, cleansers and moisturisers, mostly CeraVe, from PKR 510 up. The hydration step, which is a different thing from moisturising.',
  'smart',
  '{"match":"any","conditions":[{"field":"tag","op":"in","value":["hyaluronic-acid"]}]}'::jsonb,
  'published', 114,
  'Hyaluronic Acid Serum in Pakistan: Prices & Picks',
  'Hyaluronic acid serums, cleansers and moisturisers available in Pakistan from CeraVe, Conatural and Anua. How to apply it so it works in dry weather. Live prices, cash on delivery.',
  $html$
<h2>Hydration and moisture are not the same thing</h2>
<p>Hyaluronic acid pulls water into the upper layers of skin. It does not seal anything in. That distinction matters enormously in Pakistan, because in dry winter air a hyaluronic serum with nothing over it can pull water out of your skin instead of into it, and leave you tighter than before you started.</p>
<h3>How to actually apply it</h3>
<p>On damp skin, then a cream on top within a minute. That is the whole technique, and it is the difference between the ingredient working and people concluding it does nothing.</p>
<h3>The serum</h3>
<p>Conatural Hyaluronic Acid 2% + B5 ([[price:hyaluronic-acid-serum]]) is the straightforward option, with panthenol alongside for barrier support.</p>
<h3>If you also have redness</h3>
<p>Anua Azelaic Acid 10% + Hyaluron ([[price:anua-azelaic-10-hyaluron-redness-soothing-serum]]) treats the redness and hydrates in one step, which is useful for rosacea-prone skin that reacts to having too many products.</p>
<h3>The cream that goes on top</h3>
<p>This is the part people skip. CeraVe Moisturizing Cream ([[price:cerave-moisturizing-cream-340-grams]]) is the heavier winter option and the Daily Moisturizing Lotion ([[price:cerave-moisturizing-lotion]]) is the summer one. Both carry ceramides, which do the sealing that hyaluronic acid cannot.</p>
<h3>Starting from scratch</h3>
<p>The Hydrating Cleanser and Moisturizing Cream bundle ([[price:cerave-hydrating-cleanser-and-moisturizing-cream-bundle]]) is a complete dry-skin routine in two products, and works out cheaper than buying them separately.</p>
$html$,
  '[{"q":"Why does hyaluronic acid make my skin feel tighter?","a":"Because you applied it to dry skin in dry air with nothing over it, so it drew water from deeper in your skin and that water evaporated. Apply to damp skin and seal with a cream and the problem goes away."},
    {"q":"Hyaluronic acid or glycerin?","a":"Both are humectants and glycerin is much cheaper and arguably more reliable in dry air. Most good moisturisers contain both. Neither is a status ingredient worth paying a premium for on its own."},
    {"q":"Can I use it every day?","a":"Yes, morning and night. It is not an exfoliant or an active in the irritating sense, and there is no adjustment period."},
    {"q":"Do I still need a moisturiser if I use a hyaluronic serum?","a":"Yes, and more than ever. The serum brings water in; the moisturiser is what stops it leaving. Used alone in Pakistani winter it can leave skin drier."}]'::jsonb),

( 'collagen',
  'Collagen',
  'Marine collagen powders and sachets from Nutrifactor and VERSUS, plus collagen creams and lotions. What the evidence supports, and what it does not.',
  'smart',
  '{"match":"any","conditions":[{"field":"tag","op":"in","value":["collagen"]}]}'::jsonb,
  'published', 115,
  'Collagen Supplements in Pakistan: Prices & Types',
  'Marine and Type 1 & 3 collagen supplements available in Pakistan from Nutrifactor and VERSUS, plus collagen creams. Doses, how long results take, live prices, cash on delivery.',
  $html$
<h2>Powder or cream</h2>
<p>These are two different products that share a name. Collagen you swallow is broken into peptides and may prompt your body to make more of its own. Collagen in a cream cannot get through the skin, because the molecule is far too large, so it works as a surface moisturiser and nothing more. Both are fine purchases. Only one of them is doing what the marketing implies.</p>
<h3>The supplements</h3>
<p>Collagatin Marine Collagen 6000mg ([[price:nutrifactor-collagatin-powder]]) and VERSUS Marine Collagen ([[price:collagen-peptides-powder]]) are the sachet options. Marine collagen is absorbed somewhat better than bovine, and it also avoids the halal questions that bovine and porcine sources raise for many customers here.</p>
<h3>Tablets, if powder is not for you</h3>
<p>Nutri Collagen Type 1 &amp; 3 ([[price:nutrifactor-nutri-collagen]]) is the tablet form. Type 1 and 3 are the types found in skin, which is what you want for skin rather than joints.</p>
<h3>Collagen with vitamin C</h3>
<p>Your body cannot build collagen without vitamin C, so a supplement taken alongside it is doing more than one taken alone. The Beauty-from-Within Glow Pack ([[price:beauty-from-within-glow]]) bundles them.</p>
<h3>The creams</h3>
<p>Medicube Collagen Jelly Cream ([[price:medicube-collagen-jelly-cream]]) and the St. Ives Collagen &amp; Elastin face moisturiser ([[price:st-ives-collagen-face-moisturizer]]) and body lotion ([[price:st-ives-collagen-elastin-lotion]]) are good moisturisers. Buy them because they moisturise, not because of the word on the front.</p>
<h3>How long</h3>
<p>Eight to twelve weeks of daily use before skin studies show a measurable change. If you stop, the effect fades. This is an ongoing cost, not a course of treatment, and it is worth deciding that before the first sachet rather than after the third box.</p>
$html$,
  '[{"q":"Does collagen actually work?","a":"For skin hydration and elasticity, several trials support daily oral collagen peptides over eight to twelve weeks. The effect is real but modest. Anyone showing you a dramatic before-and-after is showing you lighting."},
    {"q":"Marine or bovine collagen?","a":"Marine is absorbed a little better and sidesteps the halal question for many customers in Pakistan. Bovine is usually cheaper. Both work."},
    {"q":"When should I take it?","a":"Any time of day, with or without food. Consistency matters far more than timing. Taking it with vitamin C helps, because your body needs vitamin C to build collagen."},
    {"q":"Can I take collagen while pregnant or breastfeeding?","a":"There is not enough safety data either way, so ask your doctor rather than assuming it is fine because it is sold without prescription."}]'::jsonb),

( 'vitamin-c',
  'Vitamin C',
  'Vitamin C for skin and for immunity: a brightening serum, chewable tablets and sachets. Two different jobs that happen to share an ingredient.',
  'smart',
  '{"match":"any","conditions":[{"field":"tag","op":"in","value":["vitamin-c"]}]}'::jsonb,
  'published', 116,
  'Vitamin C in Pakistan: Serum & Tablets, Prices',
  'Vitamin C serum for brightening plus chewable tablets and sachets for immunity, available in Pakistan. What each is for, how to store a serum, live prices, cash on delivery.',
  $html$
<h2>Two products, one vitamin</h2>
<p>Vitamin C on your skin and vitamin C in a tablet do unrelated things. Swallowing it supports immune function and helps your body build collagen. Applying it brightens pigmentation and protects against daily sun damage. Taking tablets will not brighten your face, and a serum will not shorten a cold.</p>
<h3>For skin</h3>
<p>The Vitamin C Brightening Face Serum ([[price:vitamin-c-serum]]) is the topical option here. Use it in the morning under sunscreen, where it adds to the protection rather than replacing it.</p>
<h3>Storing a vitamin C serum</h3>
<p>It oxidises. When the liquid turns from clear or pale straw to orange or brown, it has lost potency and should be replaced. Keep it away from sunlight and heat, which in a Karachi or Lahore summer means keeping it out of the bathroom windowsill.</p>
<h3>For immunity</h3>
<p>Cee 500mg chewable tablets ([[price:cee]]) and Asco-C sachets ([[price:asco-c]]) are the daily options. Around 500mg a day is the useful range for most adults. Much beyond 1000mg is mostly excreted, and large doses can upset the stomach.</p>
<h3>Vitamin C with glutathione</h3>
<p>Glutathione is poorly absorbed on its own and vitamin C helps, which is why the two are sold together. The Gluthic + CEE bundle ([[price:gluthic-cee]]) is that pairing, and the Beauty-from-Within Glow Pack ([[price:beauty-from-within-glow]]) adds collagen.</p>
<h3>During flu season</h3>
<p>The Immunity &amp; Detox Shield Combo ([[price:immunity-detox-shield-combo-total-body-defense-bundle]]) is the broader stack. Worth being realistic about what vitamin C does here: the evidence says it may slightly shorten a cold you already have, not that it prevents you catching one.</p>
$html$,
  '[{"q":"How much vitamin C should I take a day?","a":"Around 500mg suits most adults. Above 1000mg most of it is simply excreted, and high doses can cause stomach upset and, in people prone to them, kidney stones."},
    {"q":"My vitamin C serum turned orange. Is it still usable?","a":"It has oxidised and lost most of its potency. It is not dangerous, but it is no longer doing much. Store the next bottle away from light and heat."},
    {"q":"Can I use vitamin C serum with niacinamide?","a":"Yes. The idea that they cancel each other out came from studies on unstable raw ingredients at high temperature, not finished products."},
    {"q":"Does vitamin C prevent colds?","a":"No. Regular intake may shorten a cold slightly once you have one, but the evidence does not support it stopping you getting ill."}]'::jsonb),

( 'foundations',
  'Foundation',
  'Foundations from Kiko Milano, NARS, Charlotte Tilbury and Huda Beauty, PKR 7,999 to 13,500. Shade and finish advice for deeper and warmer skin tones.',
  'smart',
  '{"match":"any","conditions":[{"field":"tag","op":"in","value":["foundation"]}]}'::jsonb,
  'published', 117,
  'Foundation in Pakistan: NARS, Charlotte Tilbury, Huda',
  'Liquid foundations available in Pakistan from NARS, Charlotte Tilbury, Huda Beauty and Kiko Milano. How to pick a shade and finish for warm and deep skin. Live prices, cash on delivery.',
  $html$
<h2>Getting the shade right when you cannot swatch</h2>
<p>Buying foundation online is mostly an undertone problem. Most Pakistani skin runs warm or olive, and a shade matched only on depth will look grey or ashy even when the number is correct. Check the inside of your wrist: if the veins read green, you are warm and want a shade with a golden or yellow base. Test along the jawline, not the back of the hand, and look at it in daylight.</p>
<h3>Full coverage that still moves like skin</h3>
<p>NARS Light Reflecting Foundation ([[price:nars-light-reflecting-foundation]]) is medium coverage with a natural finish, and its shade range runs genuinely deep rather than stopping at a mid-tan.</p>
<h3>For dry skin</h3>
<p>Charlotte Tilbury Beautiful Skin ([[price:charlotte-tilbury-beautiful-skin-foundation]]) is the hydrating one and sits well on skin that usually shows every dry patch by lunchtime.</p>
<h3>For oily skin and humidity</h3>
<p>Airbrush Flawless ([[price:charlotte-tilbury-airbrush-flawless-foundation]]) is the matte, longer-wearing option, which is the one to want for a Karachi summer wedding. Huda Beauty Easy Blur ([[price:huda-beauty-easy-blur-foundation]]) gives a softer blurred finish with less weight.</p>
<h3>A cheaper way in</h3>
<p>Kiko Milano Unlimited in G5.5 Gold ([[price:kiko-milano-unlimited-foundation-5-5-gold]]) is a warm-based shade at roughly half the price of the luxury options, and a sensible way to test whether a finish suits you before spending more.</p>
<h3>Oxidation</h3>
<p>Some foundations turn darker or more orange half an hour after application as they react with skin oils. If that happens, go one shade lighter next time rather than changing the formula. Judging a shade in the first two minutes is how people end up with a bottle they never finish.</p>
$html$,
  '[{"q":"How do I pick a foundation shade online?","a":"Match the undertone first, then the depth. Warm and olive skin, which is most Pakistani skin, needs a golden or yellow base; a neutral or pink base reads ashy. Swatch along the jawline in daylight."},
    {"q":"What is oxidation and how do I avoid it?","a":"Some formulas darken as they react with skin oils, usually within half an hour. If a shade looked right on application and wrong later, choose one shade lighter next time or set with a powder."},
    {"q":"Matte or dewy in Pakistani weather?","a":"Matte or natural for summer humidity and oily skin; dewy or hydrating for winter and dry skin. A dewy foundation on oily skin in July slides off by the afternoon."},
    {"q":"Do I need a primer?","a":"Not always. A primer helps most if you have visible pores or very oily skin. On normal skin, a well-matched foundation on a moisturised face usually looks better without one."}]'::jsonb);

commit;
