-- Shopping-intent collections, batch 1 of the owner's 14 Sep 2026 list.
--
-- Why these eight, and in this order: each one is a keyword the Pakistani
-- Semrush database (pk) shows real volume for, at a difficulty we can
-- realistically reach, AND that the current catalogue can fill with enough
-- products to make a credible landing page. Volume/KD recorded per collection
-- below so the next batch can be judged on the same basis rather than on taste.
--
-- The owner's full list runs to ~50 collections. The ones left out of batch 1
-- were left out for a stated reason, not forgotten:
--   * Vitamin C  - "vitamin c" matches our ORAL supplements (Cee tablets,
--     Asco-C sachets), not serums. A collection mixing swallowable vitamin C
--     with a face serum is a bad page; revisit when vitamin C serums are stocked.
--   * Under-eye  - category 'Eyes' is eye MAKEUP here (palettes, liner,
--     mascara). "Dark Circles Solutions" needs eye creams we do not stock yet.
--   * Salicylic Acid / Azelaic / Kojic / Niacinamide as standalone ingredient
--     collections - 1 to 3 matching products each today. Their demand is real
--     (salicylic acid 14,800/mo) so they are the first to build once the
--     ingredient shelves are deeper.
--
-- Rule shape note: the resolver (src/lib/collections.ts) has no nested groups,
-- so "(A or B) and not C" is not expressible. Where an exclusion was needed the
-- rule uses match=all with a not_contains, which is why Blushes and Makeup
-- Brushes read differently from the rest. Those exclusions are load-bearing:
-- without them "Airbrush Foundation" lands in Makeup Brushes and "Blush Brush"
-- lands in Blushes.

begin;

-- Idempotent: re-running updates copy in place rather than duplicating a slug.
insert into public.collections
  (slug, title, description, type, rules, status, sort_order, seo_title, seo_description, content_html, faqs)
values

-- ── Sunscreens ────────────────────────────────────────────────────────────
-- pk volume: tinted sunscreen 2,900 (KD 21), mineral sunscreen 720 (KD 33),
-- gel sunscreen 320 (KD 14), sunscreen spray 210 (KD 13). 9 products.
-- The owner's list asked for Sunscreen Sticks / Liquid / Sprays / Mineral /
-- Clear Gel / Tinted as six separate collections; at 9 products total that
-- would be six near-empty pages, so they are one hub with the formats as
-- sections. Split them out when each format has its own shelf.
( 'sunscreens',
  'Sunscreens',
  'Every SPF we stock, from lightweight Korean fluids to the tinted formulas that work under makeup. Filtered for Pakistani weather, where a sunscreen has to survive heat and humidity without turning greasy.',
  'smart',
  '{"match":"any","conditions":[{"field":"title","op":"contains","value":"sunscreen"},{"field":"title","op":"contains","value":"spf"}]}'::jsonb,
  'published', 100,
  'Sunscreen in Pakistan: SPF 50 Picks & Prices',
  'Sunscreens for Pakistani weather: SPF 50 gels, fluids and tinted formulas that do not leave a white cast or turn greasy. Live prices, cash on delivery.',
  $html$
<h2>How to choose a sunscreen in Pakistan</h2>
<p>Heat and humidity are the whole problem. A sunscreen that feels fine in a cooler climate can turn greasy by midday in Karachi or Lahore, and that is usually why people stop reapplying. Pick the texture first, then the SPF.</p>
<h3>Gel and fluid sunscreens for oily skin</h3>
<p>Thin, fast-absorbing, no white cast. The Beauty of Joseon Relief Sun (Rice + Probiotics SPF50+, [[price:beauty-of-joseon-relief-sun-rice-probiotics-spf50]]) is the one most people here get on with, and the La Roche-Posay Anthelios UVMune 400 Invisible Fluid ([[price:la-roche-posay-anthelios-uvmune-400-invisible-fluid]]) is the pick if you want the highest UVA protection currently sold.</p>
<h3>Tinted sunscreen, if you want to skip foundation</h3>
<p>A tint evens out skin tone and hides the cast that mineral filters leave. The DRMTLGY Universal Tinted Moisturizer SPF 46 ([[price:drmtlgy-universal-tinted-moisturizer-spf-46]]) adjusts to most Pakistani skin tones, which is why one shade works where a foundation would not.</p>
<h3>Sunscreen that also treats something</h3>
<p>If you are already using actives for dark spots, the Celimax Pore + Dark Spot Brightening Care Sunscreen ([[price:celimax-pore-dark-spot-brightening-care-sunscreen]]) covers both jobs in one step.</p>
<h3>How much to actually use</h3>
<p>Two finger lengths for the face and neck. Almost nobody applies enough, and an SPF 50 applied thinly performs closer to an SPF 15. Reapply every two to three hours outdoors.</p>
$html$,
  '[{"q":"Which sunscreen is best for oily skin in Pakistan?","a":"A gel or fluid texture with no heavy oils. Beauty of Joseon Relief Sun and the La Roche-Posay Anthelios fluid both absorb fast and sit well under makeup in humid weather."},
    {"q":"Do I need sunscreen indoors in Pakistan?","a":"If you sit near a window, yes. UVA passes through glass and is the wavelength behind pigmentation and premature ageing. If you are away from windows all day you can skip it."},
    {"q":"What is a white cast and how do I avoid it?","a":"It is the pale film mineral (zinc or titanium) filters leave on deeper skin tones. Chemical or hybrid Korean filters avoid it, and a tinted sunscreen cancels it out."},
    {"q":"Is SPF 50 better than SPF 30?","a":"Slightly. SPF 30 blocks about 97 percent of UVB and SPF 50 about 98 percent. How much you apply and how often you reapply matters far more than the number."}]'::jsonb),

-- ── Moisturizers ──────────────────────────────────────────────────────────
-- pk volume: moisturizer 9,900 (KD 29). 19 products, the deepest shelf we have.
( 'moisturizers',
  'Moisturizers',
  'Creams, lotions and gel moisturizers for dry, oily and sensitive skin. Ceramide repair formulas alongside lightweight gels for humid months.',
  'smart',
  '{"match":"any","conditions":[{"field":"category","op":"in","value":["Moisturizers"]},{"field":"title","op":"contains","value":"moisturiz"},{"field":"title","op":"contains","value":"lotion"}]}'::jsonb,
  'published', 101,
  'Best Moisturizer in Pakistan: Dry & Oily Skin Picks',
  'Moisturizers for every skin type in Pakistan: ceramide creams for dry skin, light gels for oily skin, and barrier repair for irritated skin. Live prices.',
  $html$
<h2>Matching a moisturizer to your skin</h2>
<p>Most complaints about moisturizers come down to texture, not ingredients. Dry skin needs occlusives that hold water in. Oily skin needs hydration without the heavy oils, which is a different product, not a smaller amount of the same one.</p>
<h3>Dry and dehydrated skin</h3>
<p>Look for ceramides, which are the lipids your barrier is made of. The CeraVe Daily Moisturizing Lotion ([[price:cerave-moisturizing-lotion]]) is the straightforward daily option, and the St. Ives Oatmeal &amp; Shea Butter Lotion ([[price:st-ives-oatmeal-shea-lotion]]) covers body at a lower price per ml.</p>
<h3>Irritated or over-exfoliated skin</h3>
<p>If actives have left your skin stinging, stop them and repair first. La Roche-Posay Cicaplast Baume B5+ ([[price:la-roche-posay-cicaplast-baume-b5]]) is the one dermatologists in Pakistan reach for most often, and it works on cracked hands and lips too.</p>
<h3>Under the eyes</h3>
<p>Thinner skin, so a lighter formula. SKIN1004 Probio-Cica Bakuchiol Eye Cream ([[price:skin1004-probio-cica-bakuchiol-eye-cream]]) uses bakuchiol rather than retinol, which is the gentler route if the area reacts easily.</p>
<h3>When to apply</h3>
<p>On damp skin, within a minute of washing. Moisturizer works partly by sealing in the water already on your skin, so applying to a fully dry face gives you less out of the same product.</p>
$html$,
  '[{"q":"Do oily skin types need a moisturizer?","a":"Yes. Skipping it often makes oiliness worse, because skin stripped of water can produce more oil to compensate. Use a gel or lotion rather than a cream."},
    {"q":"What are ceramides and why do they matter?","a":"Ceramides are the fats that hold your skin barrier together. Skin low in them loses water faster and gets irritated more easily, which is why ceramide creams help dry and sensitive skin."},
    {"q":"Can I use the same moisturizer summer and winter?","a":"Most people in Pakistan switch. A cream that is comfortable in December can feel heavy in June, so a lighter gel through the humid months usually works better."},
    {"q":"Moisturizer before or after sunscreen?","a":"Moisturizer first, let it settle for a minute, then sunscreen as the last skincare step in the morning."}]'::jsonb),

-- ── Serums ────────────────────────────────────────────────────────────────
-- pk volume: niacinamide serum 12,100 (KD 17), vitamin c serum 12,100 (KD 44),
-- hair serum 5,400 (KD 12). 14 products. Niacinamide is the winnable half.
( 'serums',
  'Serums & Essences',
  'Targeted treatments for dark spots, redness, dehydration and texture. Niacinamide, azelaic acid, hyaluronic acid and snail mucin, with what each one actually does.',
  'smart',
  '{"match":"any","conditions":[{"field":"title","op":"contains","value":"serum"},{"field":"title","op":"contains","value":"essence"},{"field":"title","op":"contains","value":"ampoule"}]}'::jsonb,
  'published', 102,
  'Face Serums in Pakistan: Niacinamide, Azelaic & More',
  'Serums for dark spots, redness and dehydration in Pakistan. Niacinamide, azelaic acid, hyaluronic acid and snail mucin, with live prices and cash on delivery.',
  $html$
<h2>Which serum for which problem</h2>
<p>A serum is a concentrated step between cleansing and moisturizing. One at a time is usually enough, and stacking three actives is the fastest way to a damaged barrier.</p>
<h3>Dark spots and uneven tone</h3>
<p>Niacinamide is the reliable starting point and it suits most skin. The Anua Niacinamide 10% + TXA 4% Serum ([[price:anua-niacinamide-10-txa-4-serum]]) pairs it with tranexamic acid, which targets the stubborn pigmentation left behind by acne.</p>
<h3>Redness and reactive skin</h3>
<p>Azelaic acid calms inflammation and works on both acne and the redness that follows it. The Anua Azelaic Acid 10% + Hyaluron Soothing Serum ([[price:anua-azelaic-10-hyaluron-redness-soothing-serum]]) is gentle enough for daily use, and azelaic acid is one of the few actives considered safe in pregnancy.</p>
<h3>Dehydration</h3>
<p>Hyaluronic acid holds water against the skin. The Conatural Hyaluronic Acid 2% + B5 Serum ([[price:hyaluronic-acid-serum]]) is the affordable local option. Apply it to damp skin and seal with moisturizer, otherwise in dry air it can pull moisture the wrong way.</p>
<h3>Barrier repair and glow</h3>
<p>Beauty of Joseon Revive Serum with ginseng and snail mucin ([[price:beauty-of-joseon-revive-serum-ginseng-snail-mucin]]) is the one to use when skin looks tired rather than broken out.</p>
<h3>Order of application</h3>
<p>Thinnest to thickest. Cleanse, tone, serum, moisturizer, then sunscreen in the morning. Give each layer a moment to absorb.</p>
$html$,
  '[{"q":"Can I use niacinamide and vitamin C together?","a":"Yes. The old warning about them cancelling out came from lab conditions that do not apply to finished products. If your skin is sensitive, use one in the morning and one at night."},
    {"q":"How long before a serum shows results?","a":"Hydrating serums work the same day. Pigmentation serums such as niacinamide or azelaic acid need eight to twelve weeks of daily use before the difference is clear."},
    {"q":"Which serums are safe during pregnancy?","a":"Azelaic acid, niacinamide and hyaluronic acid are generally considered safe. Retinoids are not. Check with your doctor before starting anything while pregnant."},
    {"q":"How many serums can I layer?","a":"One or two. More than that raises the chance of irritation without adding much benefit, and it makes it impossible to tell which product caused a reaction."}]'::jsonb),

-- ── Blushes ───────────────────────────────────────────────────────────────
-- pk volume: liquid blush 1,600 (KD 16), cream blush 590 (KD 25), blush stick
-- 480 (KD 12), powder blush 320 (KD 11). 13 products.
-- match=all with not_contains: without it "Real Techniques Blush Brush" lands here.
( 'blushes',
  'Blushes',
  'Liquid, cream, powder and stick blushes. The formats behave differently on oily skin and in heat, which matters more here than the shade does.',
  'smart',
  '{"match":"all","conditions":[{"field":"title","op":"contains","value":"blush"},{"field":"title","op":"not_contains","value":"brush"}]}'::jsonb,
  'published', 103,
  'Blush in Pakistan: Liquid, Cream & Powder Picks',
  'Liquid, cream, powder and stick blushes available in Pakistan, with shades that read on warm and olive skin. Live prices and cash on delivery.',
  $html$
<h2>Picking a blush format</h2>
<p>Format decides how long it lasts on your skin. On oily skin in humid weather, a liquid or cream that sets will outlast a powder, which tends to slide once the skin warms up.</p>
<h3>Liquid blush</h3>
<p>The most pigmented, so use less than you think. One dot per cheek, blended fast before it sets. The SHEGLAM Color Bloom Liquid Blush ([[price:sheglam-liquid-blush-all-shades]]) is the budget entry, and the Rare Beauty Soft Pinch Liquid Blush in Hope ([[price:rare-beauty-liquid-blush-hope]]) is the one people buy after trying it on someone else.</p>
<h3>Blush sticks</h3>
<p>Easiest to control and the most forgiving if you are new to blush. Draw on the cheek, blend with a finger. Pixi On-the-Glow Blush Sticks ([[price:pixi-blush-sticks-ruby-juicy-fleur]]) work on bare skin as well as over foundation.</p>
<h3>Powder blush</h3>
<p>Best over a powdered base, and the easiest to build slowly. Dior Backstage Rosy Glow is the long-wear option if you want one that survives a full day.</p>
<h3>Shades that work on Pakistani skin</h3>
<p>Warm and olive undertones usually read better in terracotta, brick and warm rose than in cool pink, which can look grey. Deeper skin tones need more pigment, so liquids and creams beat powders.</p>
$html$,
  '[{"q":"Liquid or powder blush for oily skin?","a":"Liquid or cream that dries down. Powder sits on top of oil and tends to slide or go patchy by the afternoon in humid weather."},
    {"q":"How do I stop liquid blush looking patchy?","a":"Use less and work faster. Apply one small dot per cheek and blend before it sets, and apply it over moisturizer or foundation rather than onto dry bare skin."},
    {"q":"Which blush shade suits warm or olive skin?","a":"Terracotta, brick, peach and warm rose. Very cool blue-pinks can look ashy against warm undertones."},
    {"q":"Blush before or after setting powder?","a":"Cream and liquid blush go on before powder, powder blush after. Putting a cream over powder lifts the powder and goes blotchy."}]'::jsonb),

-- ── Cleansers ─────────────────────────────────────────────────────────────
-- pk volume: salicylic acid 14,800 (KD 21) is the big adjacent term; the
-- cleanser terms themselves are smaller but this shelf backs the acne cluster.
( 'cleansers',
  'Cleansers & Face Wash',
  'Gel, cream and foaming cleansers for oily, dry and acne-prone skin, including the hydrating formulas that do not leave skin tight.',
  'smart',
  '{"match":"any","conditions":[{"field":"title","op":"contains","value":"cleanser"},{"field":"title","op":"contains","value":"face wash"}]}'::jsonb,
  'published', 104,
  'Face Wash & Cleansers in Pakistan: Oily & Dry Skin',
  'Cleansers for oily, dry and acne-prone skin in Pakistan. Gel, cream and salicylic acid face washes that clean without stripping. Live prices.',
  $html$
<h2>Choosing a cleanser</h2>
<p>If your skin feels tight after washing, the cleanser is too harsh. That tight feeling is a stripped barrier, and it is the most common reason skin gets oilier and more reactive over time.</p>
<h3>Oily and acne-prone skin</h3>
<p>A gel cleanser, ideally with salicylic acid, which is oil-soluble and gets into the pore rather than sitting on the surface. CeraVe Acne Control Cleanser ([[price:cerave-acne-control-cleanser]]) pairs salicylic acid with ceramides so it treats without stripping.</p>
<h3>Dry and sensitive skin</h3>
<p>A cream or lotion cleanser with no foaming agents. CeraVe Hydrating Facial Cleanser ([[price:cerave-hydrating-facial-cleanser]]) and La Roche-Posay Toleriane ([[price:la-roche-posay-toleriane-hydrating-gentle-cleanser]]) both clean without leaving the face tight.</p>
<h3>On a budget</h3>
<p>The NB Sons Hydrating Face Wash ([[price:hydrating-face-wash]]) covers daily cleansing at a fraction of the imported price.</p>
<h3>How often to wash</h3>
<p>Twice a day is plenty, and once is fine for dry skin. In the morning, many people do better rinsing with water alone.</p>
$html$,
  '[{"q":"Is salicylic acid face wash good for acne?","a":"It helps with blackheads and clogged pores because salicylic acid is oil-soluble and works inside the pore. It does less for deep cystic acne, which usually needs a doctor."},
    {"q":"Why does my skin feel tight after washing?","a":"The cleanser is stripping your barrier. Switch to a gel or cream cleanser without sulphates; tightness is a warning sign, not a sign of being clean."},
    {"q":"Should I double cleanse?","a":"Only if you wear sunscreen or makeup. An oil or balm first to break it down, then your usual cleanser. On a bare-skin day one wash is enough."},
    {"q":"Can I use a face wash on my body?","a":"You can, but it is expensive per ml. Body skin is thicker and does better with a dedicated body wash."}]'::jsonb),

-- ── Lip care ──────────────────────────────────────────────────────────────
-- pk volume: lip gloss 8,100 (KD 39), lip balm 6,600 (KD 14), lipstick 6,600
-- (KD 23), lip oil 1,900 (KD 11), lip liner 1,300 (KD 35), lip plumper 1,000
-- (KD 26). 9 products. Distinct from the existing Lip & Cheek Tints collection,
-- which is shade-led; this one is format-led and carries the buying guide.
( 'lip-products',
  'Lip Gloss, Balm & Lipstick',
  'Gloss, tint, balm, liner and plumper. What each format does, and which ones survive a Pakistani summer without sliding off.',
  'smart',
  '{"match":"any","conditions":[{"field":"title","op":"contains","value":"lip gloss"},{"field":"title","op":"contains","value":"lip balm"},{"field":"title","op":"contains","value":"lip oil"},{"field":"title","op":"contains","value":"lipstick"},{"field":"title","op":"contains","value":"lip liner"},{"field":"title","op":"contains","value":"lip tint"},{"field":"title","op":"contains","value":"lip plump"}]}'::jsonb,
  'published', 105,
  'Lip Gloss, Balm & Lipstick in Pakistan: Prices',
  'Lip gloss, tints, balms, liners and plumpers available in Pakistan. Which formats last in heat, and which shades suit warm undertones. Live prices.',
  $html$
<h2>Lip formats, and what each is for</h2>
<h3>Tints, for something that stays put</h3>
<p>A tint stains the lip, so it outlasts gloss and survives tea and food. Rhode Peptide Lip Tints ([[price:rhode-peptide-lip-tints]]) add peptides and a light shine, which is why they get worn as an everyday product rather than a going-out one.</p>
<h3>Gloss, for shine</h3>
<p>Shortest wear of any format, but the easiest to reapply without a mirror. Huda Beauty Faux Filler Extra Shine ([[price:huda-beauty-faux-filler-lip-gloss]]) gives a fuller look through the shine rather than through a plumping tingle.</p>
<h3>Plumpers</h3>
<p>Most work with a mild irritant that brings blood to the surface, so the effect is temporary and some tingling is normal. The SHEGLAM Pout-Perfect Shine Lip Plumper is the affordable way to see whether you like the sensation before spending more.</p>
<h3>Balm, for dry and pigmented lips</h3>
<p>Dry lips look darker, so hydration alone often solves what people think is lip pigmentation. Saeed Ghani Ultra Hydrating Lip Balm ([[price:lip-balm]]) is the cheap daily option; Pixi LipGlow Tinted Lip Balm adds a wash of colour.</p>
<h3>Liner</h3>
<p>Stops lipstick bleeding and makes a cheap lipstick look more expensive. The Rivaj UK Lip Liner ([[price:lip-liner]]) is under a few hundred rupees and does the job.</p>
$html$,
  '[{"q":"How do I stop lipstick bleeding around my lips?","a":"Line the lips first with a liner close to your natural shade, and blot the lipstick once with a tissue before a second layer."},
    {"q":"Do lip plumpers actually work?","a":"Temporarily. Most use a mild irritant such as capsicum or cinnamon to increase blood flow, so lips look fuller for an hour or two. The tingle is the product working, not a reaction."},
    {"q":"Why are my lips dark?","a":"Most often dryness, sun exposure or smoking rather than pigmentation. Daily balm with SPF and no lip-licking usually lightens them within a few weeks."},
    {"q":"Which lip format lasts longest in hot weather?","a":"A tint or a matte liquid lipstick. Gloss and balm move as soon as the lips warm up."}]'::jsonb),

-- ── Hair care ─────────────────────────────────────────────────────────────
-- pk volume: shampoo 6,600 (KD 17), hair serum 5,400 (KD 12), hair oil 3,600
-- (KD 25), dandruff shampoo 3,600 (KD 23), conditioner 3,600 (KD 21), hair mask
-- 880 (KD 12). Only 5 products today, which is the constraint, not the demand.
-- The owner has flagged adding more hair stock; this page is ready for it.
( 'hair-care',
  'Hair Care',
  'Hair oils, masks and growth treatments for hair fall, dandruff and dry ends. A small shelf that is growing.',
  'smart',
  '{"match":"any","conditions":[{"field":"category","op":"in","value":["Hair Care"]},{"field":"title","op":"contains","value":"shampoo"},{"field":"title","op":"contains","value":"hair mask"},{"field":"title","op":"contains","value":"hair oil"},{"field":"title","op":"contains","value":"hair serum"}]}'::jsonb,
  'published', 106,
  'Hair Care in Pakistan: Oils, Masks & Hair Fall',
  'Hair oils, masks and growth treatments in Pakistan. Rosemary oil, minoxidil and deep conditioning for hair fall, dandruff and dry ends. Live prices.',
  $html$
<h2>Where to start with hair fall</h2>
<p>Some shedding is normal, around 50 to 100 strands a day. Worth investigating is a change in that rate, a widening parting, or thinning at the temples. Iron, vitamin D and thyroid are the common causes in Pakistani women, and no topical product fixes a deficiency, so a blood test first saves money.</p>
<h3>Rosemary oil</h3>
<p>The one with actual trial evidence behind it, comparable to low-strength minoxidil over six months in a small study. Conatural Rosemary Essential Oil ([[price:rosemary-oil]]) needs diluting in a carrier oil before it goes on the scalp.</p>
<h3>Minoxidil</h3>
<p>The clinically established option for pattern hair loss. Minoxin Plus 5% ([[price:minoxidil]]) works while you keep using it, and shedding in the first few weeks is expected rather than a sign it is failing.</p>
<h3>Dry and damaged lengths</h3>
<p>A mask does in ten minutes what a conditioner cannot do in one. The OGX Argan Oil of Morocco Hair Mask ([[price:argan-oil-of-morocco-hair-mask]]) is the weekly treatment for heat-damaged or colour-treated hair.</p>
<h3>Castor oil</h3>
<p>Thick, so mix it with a lighter oil. Hemani Castor Oil ([[price:castor-oil]]) is the traditional choice for brows and lashes as well as scalp.</p>
$html$,
  '[{"q":"Does rosemary oil really help hair growth?","a":"There is reasonable evidence. A small trial found it comparable to 2 percent minoxidil over six months for pattern hair loss. Dilute it in a carrier oil and give it six months before judging."},
    {"q":"Why is my hair falling out?","a":"In Pakistan the most common causes are low iron, low vitamin D and thyroid problems, alongside genetic pattern loss. Get bloods checked before spending on treatments."},
    {"q":"How often should I oil my hair?","a":"Once or twice a week, on the scalp, for a few hours before washing. Leaving oil in for days can worsen dandruff on an oily scalp."},
    {"q":"Is minoxidil safe to use long term?","a":"It is well studied and widely used, but it only works while you keep applying it. Speak to a doctor before starting, especially if you are pregnant or breastfeeding."}]'::jsonb),

-- ── Makeup brushes ────────────────────────────────────────────────────────
-- pk volume: makeup brush 3,600 (KD 9), foundation brush 1,600 (KD 10), blush
-- brush 880 (KD 21), eyeshadow brush 480 (KD 11). The lowest difficulty on the
-- whole list. Only 3 products, so this page is a demand placeholder that is
-- already worth publishing: the term is winnable and the shelf can be filled.
( 'makeup-brushes',
  'Makeup Brushes & Tools',
  'Face, blush and eye brushes plus blending sponges. Real Techniques sets that cover a full routine without buying pieces one at a time.',
  'smart',
  '{"match":"all","conditions":[{"field":"title","op":"contains","value":"brush"},{"field":"title","op":"not_contains","value":"airbrush"}]}'::jsonb,
  'published', 107,
  'Makeup Brushes in Pakistan: Sets & Prices',
  'Makeup brushes and blending sponges in Pakistan. Face, blush and eyeshadow brushes, plus Real Techniques sets. Live prices and cash on delivery.',
  $html$
<h2>Which brushes you actually need</h2>
<p>Four will cover almost everything: one for base, one for blush, one for powder, and a sponge for blending edges. Large sets look better value but most of the pieces go unused.</p>
<h3>Starting from nothing</h3>
<p>The Real Techniques Everyday Essentials Brush &amp; Sponge Set ([[price:real-techniques-brush-set]]) is the sensible first purchase, and it includes the sponge so you are not buying one separately.</p>
<h3>Base only</h3>
<p>If you already own eye brushes, the Real Techniques Face Base Brush Set ([[price:real-techniques-face-base-brush-set]]) covers foundation, concealer and setting powder.</p>
<h3>Blush</h3>
<p>A dedicated blush brush is smaller and softer than a powder brush, which is what stops blush going on as a stripe. The Real Techniques Blush Brush 400 ([[price:blush-brush-by-real-techniques]]) is the standalone option.</p>
<h3>Washing them</h3>
<p>Every one to two weeks for base brushes, which hold the most product and the most bacteria. Mild shampoo, lukewarm water, reshape and dry flat with the bristles hanging over an edge. Drying upright lets water sit in the glue and the brush sheds.</p>
$html$,
  '[{"q":"How many makeup brushes do I need?","a":"Four covers a full face: a base brush, a blush brush, a powder brush and a blending sponge. Add eye brushes only if you wear eyeshadow regularly."},
    {"q":"How often should I wash makeup brushes?","a":"Base and concealer brushes every one to two weeks, eye brushes monthly. Unwashed base brushes hold bacteria and are a common cause of breakouts along the jaw."},
    {"q":"Brush or sponge for foundation?","a":"A brush gives more coverage, a damp sponge gives a lighter, more natural finish. Many people use a brush to apply and a sponge to blend the edges."},
    {"q":"Do expensive brushes make a difference?","a":"Mainly in shedding and how evenly they blend. A mid-range set such as Real Techniques gets you most of the benefit; the jump to luxury brushes is small."}]'::jsonb)

on conflict (slug) do update set
  title           = excluded.title,
  description     = excluded.description,
  type            = excluded.type,
  rules           = excluded.rules,
  seo_title       = excluded.seo_title,
  seo_description = excluded.seo_description,
  content_html    = excluded.content_html,
  faqs            = excluded.faqs,
  updated_at      = now();

commit;
