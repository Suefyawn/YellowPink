-- Long-form content for the ten highest-earning brand pages that had none.
--
-- ── Why brand pages, ahead of more blog posts ──────────────────────────────
-- The order data says brand pages are the most valuable landing page the
-- store has. Over 365 days, by the page a buyer arrived on:
--
--   brand page      5 orders   PKR 33,109 kept   PKR 6,622 per order
--   product page   12 orders   PKR 41,772        PKR 3,481
--   blog post       6 orders   PKR 17,390        PKR 2,898
--   no source      13 orders   PKR 25,131        PKR 1,933
--
-- Caveat stated plainly: n=5, and three of those five were the same page
-- (/brand/la-roche-posay), so the high value may be that premium brand rather
-- than brand pages as a category. This batch is partly a test of that.
--
-- What is NOT ambiguous is this: the three brand pages that produced orders
-- (La Roche-Posay, Nutrifactor, Rivaj UK) ALL already had long-form content,
-- and only 14 of 59 brand pages do. If brand-page orders were spread evenly
-- across brands, the chance of all three landing on a content-bearing page is
-- about 1 in 75. Thin evidence, but it points one way, and the fix is cheap.
--
-- Brand pages are also the cheapest content in the store to produce: the
-- brand is known, the products are known, nothing needs researching. A blog
-- post needs a topic, sources and a hero image.
--
-- ── Selection ──────────────────────────────────────────────────────────────
-- Ranked by kept revenue over 365 days, excluding brands that already have
-- content, and requiring enough catalogue to fill a page:
--
--   Anua              PKR 16,000    2 products
--   NARS                  15,797    3
--   NB Sons               14,090   60
--   Beauty of Joseon      11,996    6
--   SKIN1004               8,630    3
--   PIXI                    4,197   10
--   Real Techniques         3,999    3
--   SHEGLAM                 3,198    5
--   Medicube                    0    7   (no orders yet, deepest untapped)
--   Huda Beauty                 0    6   (no orders yet, highest ticket)
--
-- Shape follows the collection pages that are already cited: a buyer's guide
-- that helps someone choose, not brand marketing, plus four FAQs which the
-- page emits as FAQPage structured data.
--
-- [[price:slug]] tokens render at fetch time, so prices in the copy never go
-- stale. The brand page renders content_html and faqs through
-- renderContentTokens / renderFaqTokens (src/app/brand/[slug]/page.tsx).

begin;

-- ── Anua ───────────────────────────────────────────────────────────────────
update public.brands set
  content_html = $html$
<h2>Choosing between the two Anua serums</h2>
<p>Anua is a Korean brand that built its reputation on single-purpose serums with the active percentage printed on the bottle. Two of them are here, and they solve different problems, so the choice is straightforward once you know which one you have.</p>
<h3>If your face goes red</h3>
<p>Azelaic Acid 10% + Hyaluron ([[price:anua-azelaic-10-hyaluron-redness-soothing-serum]]) is the one for redness, rosacea-prone skin and the flushing that comes with it. Azelaic acid also works on the bumpy texture that often arrives with the redness, and the hyaluronic acid means it hydrates in the same step rather than needing a separate one.</p>
<h3>If the problem is dark marks</h3>
<p>Niacinamide 10% + TXA 4% ([[price:anua-niacinamide-10-txa-4-serum]]) pairs two actives that fade pigment by different routes, which is why it is stronger on melasma and old acne marks than niacinamide alone.</p>
<h3>Using both</h3>
<p>They layer, but there is no need to rush into it. Start with one for six weeks, see what changes, then decide. Skin that gets four new actives at once tells you nothing about which one worked.</p>
<h3>What to expect, and when</h3>
<p>Redness settles inside two to three weeks. Pigmentation takes eight to twelve, and only alongside daily sunscreen. That is not a limitation of these serums; it is how pigment works.</p>
$html$,
  faqs = '[{"q":"Which Anua serum should I start with?","a":"Azelaic Acid + Hyaluron if your main complaint is redness or flushing. Niacinamide + TXA if it is dark spots, melasma or marks left by old acne."},
    {"q":"Can I use both together?","a":"Yes, they layer fine. But using one at a time for the first six weeks tells you which is actually working for your skin."},
    {"q":"Is azelaic acid safe in pregnancy?","a":"Azelaic acid is one of the actives usually considered acceptable in pregnancy, unlike retinoids. Confirm with your own doctor rather than taking a shop page for medical advice."},
    {"q":"Are these authentic Korean stock?","a":"Yes. Everything we list under Anua is imported stock, and you can pay cash on delivery anywhere in Pakistan."}]'::jsonb,
  updated_at = now()
where slug = 'anua';

-- ── Beauty of Joseon ───────────────────────────────────────────────────────
update public.brands set
  content_html = $html$
<h2>Where to start with Beauty of Joseon</h2>
<p>Beauty of Joseon builds around rice extract and ginseng, and it is the rare Korean brand where the sunscreens are as good as the serums. For most people in Pakistan the sunscreen is the right first purchase, because it is the product you will use every single day.</p>
<h3>The two sunscreens, and which is which</h3>
<p>Relief Sun: Rice + Probiotics ([[price:beauty-of-joseon-relief-sun-rice-probiotics-spf50]]) is the famous one: a light organic filter with no white cast, which is what makes it work on medium and deep skin where mineral sunscreens go grey. Relief Sun Aqua-Fresh ([[price:beauty-of-joseon-relief-sun-aqua-fresh-rice-b5-spf50]]) is the lighter, more watery version, and the one to pick for oily skin or a Karachi summer.</p>
<h3>For dullness and uneven tone</h3>
<p>Glow Deep Serum: Rice + Alpha-Arbutin ([[price:beauty-of-joseon-glow-deep-serum-rice-alpha-arbutin]]) is the brightening one. Alpha-arbutin is a gentler route to fading pigment than hydroquinone and does not carry the same rebound problem.</p>
<h3>For dryness and early lines</h3>
<p>Revive Serum: Ginseng + Snail Mucin ([[price:beauty-of-joseon-revive-serum-ginseng-snail-mucin]]) is the richer treatment, and the Revive Eye Serum with retinal ([[price:beauty-of-joseon-revive-eye-serum-ginseng-retinal]]) takes the same idea to the eye area. Retinal is stronger than retinol, so use it two nights a week before going further.</p>
<h3>The weekly step</h3>
<p>Ground Rice &amp; Honey Glow Mask ([[price:beauty-of-joseon-ground-rice-honey-glow-mask]]) exfoliates gently enough for most skin once or twice a week.</p>
<h3>A sensible first order</h3>
<p>Sunscreen, then one serum for your main concern. That is two products and it will do more than a six-step routine bought all at once.</p>
$html$,
  faqs = '[{"q":"Which Beauty of Joseon sunscreen is better?","a":"Relief Sun Rice + Probiotics for normal to dry skin, Aqua-Fresh for oily skin and hot weather. Neither leaves a white cast, which is the usual complaint with sunscreen on deeper skin tones."},
    {"q":"Does the Relief Sun leave a white cast?","a":"No. It uses organic filters rather than a heavy mineral base, which is exactly why it became the brand most recommended for medium and deep skin."},
    {"q":"Snail mucin or ginseng, what is the Revive Serum actually for?","a":"Both. Snail mucin for hydration and repair, ginseng for dullness and early lines. It is the brand pick for dry or tired-looking skin rather than for acne."},
    {"q":"Is the eye serum with retinal too strong for beginners?","a":"Start at two nights a week. Retinal is more potent than retinol, and the eye area is thin, so building up slowly matters more here than anywhere else on the face."}]'::jsonb,
  updated_at = now()
where slug = 'beauty-of-joseon';

-- ── SKIN1004 ───────────────────────────────────────────────────────────────
update public.brands set
  content_html = $html$
<h2>SKIN1004 and centella</h2>
<p>SKIN1004 is built almost entirely around one ingredient: centella asiatica, grown in Madagascar. Centella calms irritated skin and supports the barrier, which makes this the brand to reach for when your skin is reacting rather than when you want to push it harder.</p>
<h3>Sunscreen first</h3>
<p>The Madagascar Centella Tone-Up Sunscreen ([[price:skin1004-madagascar-centella-tone-up-sunscreen]]) is SPF50+ PA++++ with a slight tone-up. Worth knowing before you buy: a tone-up sunscreen leaves a deliberate light cast, which some people like as a base and others do not want at all.</p>
<h3>For uneven tone</h3>
<p>The Tone Brightening Capsule Ampoule ([[price:centella-tone-brightening-capsule-ampoule-100-ml]]) is the larger 100ml bottle, which makes it one of the better value brightening treatments here per millilitre.</p>
<h3>For the eye area</h3>
<p>Probio-Cica Bakuchiol Eye Cream ([[price:skin1004-probio-cica-bakuchiol-eye-cream]]) uses bakuchiol rather than retinol. Bakuchiol is the gentler option and the one usually suggested for people who found retinol too irritating around the eyes.</p>
<h3>If your skin is currently angry</h3>
<p>This is the brand for it. Centella products are the ones to use while a barrier recovers, not the ones to drop when it does.</p>
$html$,
  faqs = '[{"q":"What does centella asiatica actually do?","a":"It calms irritation and supports the skin barrier. It is the ingredient to use when skin is red, reactive or recovering from a stronger active, rather than one that changes pigment or texture on its own."},
    {"q":"Does the tone-up sunscreen leave a white cast?","a":"It leaves a deliberate light tone-up, which is the point of the product. If you do not want any cast at all, an untinted sunscreen is the better choice."},
    {"q":"Bakuchiol or retinol for the eye area?","a":"Bakuchiol is gentler and does not carry retinol adjustment period. It is slower, but for thin eye-area skin that is usually the right trade."},
    {"q":"Is SKIN1004 suitable for sensitive skin?","a":"It is one of the safer Korean brands for reactive skin, because centella is the through-line in nearly everything they make."}]'::jsonb,
  updated_at = now()
where slug = 'skin1004';

-- ── Medicube ───────────────────────────────────────────────────────────────
update public.brands set
  content_html = $html$
<h2>Medicube, by concern</h2>
<p>Medicube is a Korean brand that leans clinical: the products are named after their actives rather than their scent, and the range is organised around pigmentation, pores and texture.</p>
<h3>For dark spots and melasma</h3>
<p>Two routes, and they can be used together. Kojic Acid Turmeric Vita Capsule Cream ([[price:medicube-kojic-acid-turmeric-vita-capsule-cream]]) is the kojic acid one; TXA + Niacinamide Capsule Cream ([[price:medicube-txa-niacinamide-capsule-cream]]) uses tranexamic acid, which is the ingredient dermatologists reach for on stubborn melasma. The Kojic Acid Turmeric Gel Mask ([[price:medicube-kojic-acid-turmeric-brightening-gel-mask]]) is the single-sheet version if you want to try the idea before committing to a jar.</p>
<h3>For pores and blackheads</h3>
<p>Zero Pore Blackhead Deep Cleansing Oil ([[price:medicube-zero-pore-blackhead-cleansing-oil]]) is a first-cleanse oil, used on dry skin before your normal wash. That order matters: cleansing oil on a wet face does very little.</p>
<h3>For texture</h3>
<p>Red Succinic Acid Peeling Pads ([[price:medicube-red-succinic-acid-peeling-pad]]) are the exfoliating step. Two or three times a week is plenty; every night is how people end up with a stinging face.</p>
<h3>For firmness and hydration</h3>
<p>PDRN Pink Peptide Serum ([[price:medicube-pdrn-pink-peptide-serum]]) and the Collagen Jelly Cream ([[price:medicube-collagen-jelly-cream]]) are the plumping end of the range. Worth being straight about the cream: collagen molecules are far too large to pass through skin, so it works as a good moisturiser, not as collagen replacement.</p>
$html$,
  faqs = '[{"q":"Kojic acid or tranexamic acid for melasma?","a":"Tranexamic acid has the stronger evidence for melasma specifically. Kojic acid is effective on general dark spots and post-acne marks. Plenty of people use both, at different times of day."},
    {"q":"How do I use a cleansing oil properly?","a":"On DRY skin, before anything else. Massage it in, then add water to emulsify, then rinse and follow with your normal cleanser. Applying it to a wet face wastes most of it."},
    {"q":"How often should I use the peeling pads?","a":"Two or three times a week. They are an exfoliant, and daily use on most skin causes more irritation than it clears."},
    {"q":"Does a collagen cream actually add collagen to my skin?","a":"No. The molecule is too large to get through. It is a good moisturiser and should be bought as one. For collagen itself, an oral supplement has better evidence."}]'::jsonb,
  updated_at = now()
where slug = 'medicube';

-- ── PIXI ───────────────────────────────────────────────────────────────────
update public.brands set
  content_html = $html$
<h2>PIXI, glow and the tonic that started it</h2>
<p>PIXI sits between skincare and makeup, and most people arrive through one product: Glow Tonic.</p>
<h3>Glow Tonic, and which one</h3>
<p>The original is a 5% glycolic acid toner ([[price:pixi-glow-tonic-5-glycolic-acid-toner]]), used on a cotton pad a few nights a week for dullness and uneven texture. The Glow Tonic Serum ([[price:pixi-glow-tonic-serum]]) is the leave-on version in a smaller bottle. Start with the toner: it is the one with the track record, and it goes further.</p>
<h3>The oils</h3>
<p>Overnight Retinol Oil ([[price:pixi-overnight-retinol-oil]]) is the night treatment for lines and texture. Do not use it on the same night as the glycolic toner when you are starting out. Jasmine Oil Blend ([[price:pixi-jasmine-oil-blend]]) is the non-active one, for dryness alone.</p>
<h3>The glow sticks</h3>
<p>This is what PIXI is best known for after the tonic. On-the-Glow Blush Sticks ([[price:pixi-blush-sticks-ruby-juicy-fleur]]), the SuperGlow Highlighter Stick ([[price:highlighter-sticks-by-pixi]]) and On-the-Glow Bronze ([[price:pixi-bronzer]]) all apply with a fingertip and need no brush, which is why they suit people who do not really do makeup.</p>
<h3>The duos</h3>
<p>If you want two at once, the Radiant Glow Duo ([[price:pixi-blush-highlighter-duo]]) pairs blush and highlighter, and the Soft Glow Duo ([[price:pixi-blush-bronzer-duo]]) pairs blush and bronze. Both work out cheaper than buying the sticks separately.</p>
<h3>And the everyday one</h3>
<p>LipGlow Tinted Lip Balm ([[price:pixi-lipglow]]) is the low-commitment product in the range: a balm with enough tint to count as makeup.</p>
$html$,
  faqs = '[{"q":"Glow Tonic toner or Glow Tonic Serum?","a":"The 5% glycolic toner is the one to start with. It is the original, the bottle lasts far longer, and it is the version most people mean when they recommend Glow Tonic."},
    {"q":"How often should I use Glow Tonic?","a":"Two or three nights a week at first. It is a glycolic acid, so daily use from day one tends to cause irritation rather than faster results."},
    {"q":"Can I use the Retinol Oil and Glow Tonic on the same night?","a":"Not when you are starting. Alternate nights until your skin is comfortable with both, then judge. Retinol plus a glycolic acid together is a common cause of a stinging, flaking face."},
    {"q":"Do the glow sticks need a brush?","a":"No. They are made to be applied and blended with a fingertip, which is the main reason people pick them over powder."}]'::jsonb,
  updated_at = now()
where slug = 'pixi';

-- ── NARS ───────────────────────────────────────────────────────────────────
update public.brands set
  content_html = $html$
<h2>NARS, and the two products worth the money</h2>
<p>NARS is a professional makeup brand with a deep shade range, which is the reason it keeps getting recommended for medium, olive and deep skin where cheaper foundations run ashy or orange.</p>
<h3>The foundation</h3>
<p>Light Reflecting Foundation ([[price:nars-light-reflecting-foundation]]) is medium coverage with a natural, slightly luminous finish, and it moves like skin rather than sitting on top of it. Its shade range genuinely runs deep instead of stopping at a mid-tan, which is the practical reason to choose it over a cheaper bottle you then have to mix.</p>
<h3>Shade matching without a counter</h3>
<p>Match the undertone before the depth. Most Pakistani skin is warm or olive, so a shade with a golden base reads correct where a neutral or pink one goes grey. Swatch along the jawline in daylight, and give it half an hour before deciding, because some foundations oxidise and darken as they react with skin oils.</p>
<h3>The blush</h3>
<p>Afterglow Liquid Blush ([[price:nars-afterglow-liquid-blush]]) is buildable and blends into the base rather than sitting over it, which is what makes liquid blush last through a humid day better than powder.</p>
<h3>Buying both</h3>
<p>The Orgasm blush and Tarte concealer bundle ([[price:nars-blush-and-tarte-concealer-bundle]]) is the cheaper way into the blush if you also need a concealer.</p>
$html$,
  faqs = '[{"q":"How do I pick a NARS foundation shade online?","a":"Undertone first, depth second. Warm and olive skin needs a golden base; neutral and pink bases read ashy. Swatch on the jawline in daylight and wait half an hour before judging."},
    {"q":"Is NARS Light Reflecting Foundation full coverage?","a":"No, it is medium and buildable with a natural finish. If you want full matte coverage, this is the wrong one to choose."},
    {"q":"Liquid blush or powder blush?","a":"Liquid blends into the foundation and lasts better in humidity, which matters in Pakistani summer. Powder is easier to control if you are new to blush."},
    {"q":"What is oxidation and does it affect this foundation?","a":"Oxidation is a formula darkening as it reacts with your skin oils, usually within half an hour. If a shade looked right on application and wrong later, go one shade lighter next time."}]'::jsonb,
  updated_at = now()
where slug = 'nars';

-- ── Huda Beauty ────────────────────────────────────────────────────────────
update public.brands set
  content_html = $html$
<h2>Huda Beauty, and what it is actually good at</h2>
<p>Huda Beauty was built for full-coverage, long-wearing looks, which is precisely what a Pakistani wedding season asks of makeup. The range here is the base and the lips.</p>
<h3>Base</h3>
<p>Easy Blur Natural Airbrush Foundation ([[price:huda-beauty-easy-blur-foundation]]) is the lighter, blurred-finish option rather than a heavy matte, and #FauxFilter Luminous Matte Concealer ([[price:huda-beauty-fauxfilter-concealer]]) is the high-coverage concealer the brand is known for.</p>
<h3>Setting, and why it matters here</h3>
<p>Easy Bake Loose Powder ([[price:huda-beauty-easy-bake-loose-powder]]) is what makes the difference between a base that survives a long evening and one that slides. Baking means pressing a generous layer into the under-eye and T-zone, leaving it five to ten minutes, then dusting it off. In humidity it is the step that actually holds everything in place.</p>
<h3>Eyes</h3>
<p>The Nude Obsessions palette ([[price:huda-beauty-nude-obsessions-palette]]) is the everyday one, built on neutrals that work across a wide range of skin tones rather than a single colour story.</p>
<h3>Lips</h3>
<p>Liquid Matte Ultra-Comfort lipstick ([[price:huda-beauty-icon-liquid-lipstick]]) is the transfer-proof option, and Faux Filler Extra Shine Gloss ([[price:huda-beauty-faux-filler-lip-gloss]]) is the plumping gloss. The gloss gives a mild tingle; that is the formula working as intended, not a reaction.</p>
$html$,
  faqs = '[{"q":"What does baking powder actually do?","a":"You press a thick layer into the under-eye and T-zone, leave it five to ten minutes so body heat sets the foundation underneath, then dust off the excess. It is what keeps a base from sliding through a long humid evening."},
    {"q":"Is Easy Blur foundation full coverage?","a":"No, it is a blurring medium coverage with a soft finish. For full coverage, layer the FauxFilter concealer where you need it rather than building the foundation."},
    {"q":"Is the lip plumper tingle normal?","a":"Yes, a mild tingle is the formula working. It should not burn or sting sharply; if it does, wipe it off."},
    {"q":"Is the Nude Obsessions palette suitable for deeper skin tones?","a":"Yes. The neutrals run warm and pigmented rather than pale and chalky, which is what usually fails on deeper skin."}]'::jsonb,
  updated_at = now()
where slug = 'huda-beauty';

-- ── SHEGLAM ────────────────────────────────────────────────────────────────
update public.brands set
  content_html = $html$
<h2>SHEGLAM, the affordable end</h2>
<p>SHEGLAM is where to experiment. The formulas are genuinely decent and the prices are low enough that trying a colour you are unsure about does not really cost anything.</p>
<h3>Blush, three ways</h3>
<p>Color Bloom Liquid Blush ([[price:sheglam-liquid-blush-all-shades]]) is the one to start with: a few drops blend into the base and last well in heat. Buttery Bliss Blush Stick ([[price:sheglam-buttery-bliss-blush-stick]]) is the same idea in a stick, easier to carry and to apply without a mirror.</p>
<h3>Primer</h3>
<p>Good Grip Hydrating Primer ([[price:sheglam-good-grip-primer]]) is worth it mainly if you have visible pores or very oily skin. On normal skin a well-matched foundation on a moisturised face usually looks better with no primer at all.</p>
<h3>Lips</h3>
<p>Dynamatte Boom long-lasting matte lipstick ([[price:sheglam-dynamatte-boom-lipstick-ember-rose-set]]) comes as a set, which is the cheapest way to find out which shade family suits you. Pout-Perfect Shine Lip Plumper ([[price:sheglam-pout-perfect-shine-lip-plumper]]) is the gloss option.</p>
<h3>A note on matte lipstick</h3>
<p>Long-wear matte formulas are drying by design; that is how they stay put. A balm underneath, blotted before the colour goes on, fixes most of it.</p>
$html$,
  faqs = '[{"q":"Liquid blush or a blush stick?","a":"Liquid blends more seamlessly into foundation and lasts longer in heat. The stick is easier to apply on the go and needs no brush."},
    {"q":"Do I need a primer?","a":"Only really if you have visible pores or very oily skin. On normal skin, a well-matched foundation over moisturiser usually looks better without one."},
    {"q":"Why does matte lipstick dry my lips?","a":"Long-wear matte formulas work by removing moisture so the colour stays put. Use a balm first, blot it, then apply, and reapply balm at night."},
    {"q":"Is SHEGLAM good quality for the price?","a":"For blush, lips and primer, yes. It is the range to use for trying a colour you are unsure about, rather than paying several times more to find out you do not like it."}]'::jsonb,
  updated_at = now()
where slug = 'sheglam';

-- ── Real Techniques ────────────────────────────────────────────────────────
update public.brands set
  content_html = $html$
<h2>Real Techniques, and which set you need</h2>
<p>Good brushes change how makeup looks more than most people expect, and Real Techniques is the brand that made decent synthetic brushes affordable. The bristles are synthetic throughout, which matters practically: synthetic brushes handle liquid and cream products better than natural hair, and they wash more easily.</p>
<h3>Starting from nothing</h3>
<p>The Everyday Essentials Brush &amp; Sponge Set ([[price:real-techniques-brush-set]]) is the complete answer: four brushes for face, cheeks and eyes plus the Miracle Complexion Sponge. If you own no brushes at all, buy this one and stop.</p>
<h3>If you only do base</h3>
<p>The Face Base Brush Set ([[price:real-techniques-face-base-brush-set]]) covers foundation and concealer without the eye brushes, which is the sensible pick if eyeshadow is not part of your routine.</p>
<h3>Adding one brush</h3>
<p>The Blush Brush 400 ([[price:blush-brush-by-real-techniques]]) on its own is the cheapest real upgrade available to most people. Powder blush applied with a decent brush instead of whatever came in the compact looks like a different product.</p>
<h3>Looking after them</h3>
<p>Wash brushes weekly with a brush cleanser. Rinse the sponge after every use, deep clean it weekly, and replace it roughly every 30 uses. A dirty sponge is a genuine cause of breakouts, and it is the step nearly everyone skips.</p>
$html$,
  faqs = '[{"q":"Which Real Techniques set should I buy first?","a":"The Everyday Essentials Brush and Sponge Set if you own nothing, because it covers face, cheeks and eyes in one purchase. The Face Base set if you only wear foundation and concealer."},
    {"q":"How often should I wash makeup brushes?","a":"Weekly for brushes, and rinse the sponge after every single use with a weekly deep clean. An unwashed sponge holds bacteria and is a real cause of breakouts."},
    {"q":"Are the brushes synthetic?","a":"Yes, all of them, and they are cruelty-free and vegan. Synthetic bristles also handle liquid and cream products better than natural hair does."},
    {"q":"When should I replace the sponge?","a":"Real Techniques suggests around every 30 uses. If it has stains that will not wash out, or it has started to tear, replace it sooner."}]'::jsonb,
  updated_at = now()
where slug = 'real-techniques';

-- ── NB Sons ────────────────────────────────────────────────────────────────
update public.brands set
  content_html = $html$
<h2>NB Sons, by what you are trying to fix</h2>
<p>NB Sons is the widest supplement range in the store, and the products are named after what they do rather than after a marketing idea. The catalogue is easiest to navigate by concern.</p>
<h3>Men's health</h3>
<p>The Peak Performance Stack ([[price:mens-peak-performance]]) is the complete option for stamina and fertility. Taken separately, Argivital L-Arginine sachets ([[price:argivital-sachet]]) work on blood flow, Trimo-M ([[price:trimo-m]]) on libido and fertility, and Flex-4 ([[price:flex-4]]) is the daily vitality tablet. X-Fit + Trimo-M ([[price:x-fit-trimo-m]]) is the mid-sized combination.</p>
<h3>Skin from the inside</h3>
<p>Gluthic glutathione tablets ([[price:gluthic]]) are the brightening supplement. Glutathione absorbs poorly on its own, which is why the Gluthic + CEE bundle ([[price:gluthic-cee]]) pairs it with vitamin C, and why the Beauty-from-Within Glow Pack ([[price:beauty-from-within-glow]]) adds collagen and a digestive component.</p>
<h3>Trying to conceive</h3>
<p>The Couple's Pack ([[price:couples-conceive-pack]]) covers both partners, which is the sensible approach: fertility is a two-person question and roughly half of cases involve a male factor.</p>
<h3>Bones</h3>
<p>Calco Fit + Vit KD ([[price:calco-fit-vit-kd]]) pairs calcium with vitamin K and D. That combination matters more than the calcium dose on its own, because without D your body absorbs little of it.</p>
<h3>Expectations</h3>
<p>Supplements work on a scale of months, not days, and none of these replaces a diagnosis. If something is persistently wrong, see a doctor first and use these alongside what they advise.</p>
$html$,
  faqs = '[{"q":"How long before a supplement does anything?","a":"Most work on a scale of eight to twelve weeks, not days. Anything promising a result in a week is overselling."},
    {"q":"Why is glutathione sold with vitamin C?","a":"Glutathione is poorly absorbed on its own. Vitamin C supports it, which is why the two are bundled rather than sold separately."},
    {"q":"Should both partners take something when trying to conceive?","a":"Usually yes. Around half of fertility difficulties involve a male factor, which is why the Couple Pack covers both rather than only the woman."},
    {"q":"Can I take these with prescribed medicine?","a":"Ask your doctor or pharmacist first. Supplements can interact with prescriptions, and a shop page is not the place to settle that question."}]'::jsonb,
  updated_at = now()
where slug = 'nb-sons';

commit;
