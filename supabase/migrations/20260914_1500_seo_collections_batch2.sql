-- Shopping-intent collections, batch 2. Same selection rule as batch 1
-- (20260914_1400): Semrush pk volume and difficulty, constrained by how many
-- catalogue products the rule actually resolves to, so nothing ships as a
-- near-empty page.
--
--   Body Care    body wash 5,400 (KD 14) + body scrub 4,400 (KD 13) +
--                shower gel 1,600 (KD 14) + body lotion 1,300 (KD 22) +
--                body butter 1,300 (KD 11). 11 products. The strongest
--                remaining opportunity on the owner's list by combined volume
--                against difficulty.
--   Highlighters highlighter 5,400 (KD 14), highlighter makeup 1,000 (KD 18).
--                5 products spanning PKR 1,380 to 11,000.
--   Face Scrubs  face scrub 2,400 (KD 29), exfoliator 2,900 (KD 54). 6 products.
--   Toners       toner 1,900 (KD 24), face toner 320 (KD 11). 5 products.
--
-- Still deferred for lack of stock, not lack of demand: concealer (6,600,
-- KD 18) has 4 products, face mask (4,400, KD 14) has 4. Both are the next
-- ones to build when those shelves are deeper.

begin;

insert into public.collections
  (slug, title, description, type, rules, status, sort_order, seo_title, seo_description, content_html, faqs)
values

( 'body-care',
  'Body Care',
  'Body washes and hand and body lotions in 600ml and 650ml sizes. The bottles that last a household a month rather than a week.',
  'smart',
  '{"match":"any","conditions":[{"field":"title","op":"contains","value":"body wash"},{"field":"title","op":"contains","value":"hand & body"},{"field":"title","op":"contains","value":"body lotion"}]}'::jsonb,
  'published', 108,
  'Body Wash & Body Lotion in Pakistan: Prices',
  'Body washes and hand and body lotions in Pakistan, in 600ml and 650ml sizes. Oatmeal, shea, coconut and rose formulas. Live prices, cash on delivery.',
  $html$
<h2>Choosing a body wash and lotion</h2>
<p>Body skin is thicker than facial skin and takes more of a beating from hard water, which is most of Pakistan. The pattern that works for nearly everyone is a wash that does not strip, then a lotion within a few minutes of getting out of the shower.</p>
<h3>Dry, itchy or tight skin</h3>
<p>Oatmeal is the ingredient with the longest track record for calming itch. The Soothing Oatmeal &amp; Shea Butter Body Wash ([[price:st-ives-oatmeal-shea-body-wash]]) and the matching lotion ([[price:st-ives-oatmeal-shea-lotion]]) are the pair to use through winter.</p>
<h3>Rough patches on arms and legs</h3>
<p>An exfoliating wash does more for bumpy upper arms than a scrub once a week. The Exfoliating Sea Salt &amp; Pacific Kelp Body Wash ([[price:st-ives-sea-salt-kelp-body-wash]]) and the Pink Lemon &amp; Mandarin version ([[price:st-ives-pink-lemon-mandarin-body-wash]]) both work on that.</p>
<h3>Ageing or crepey skin</h3>
<p>Collagen &amp; Elastin Hand &amp; Body Lotion ([[price:st-ives-collagen-elastin-lotion]]) is the heavier option, and the Rose &amp; Argan Oil lotion ([[price:st-ives-rose-argan-lotion]]) is the one to reach for if you want a scent that lingers.</p>
<h3>Everyday hydration</h3>
<p>Vitamin E &amp; Avocado ([[price:st-ives-vitamin-e-avocado-lotion]]) and Coconut &amp; Orchid ([[price:st-ives-coconut-orchid-lotion]]) are the lighter daily lotions, which matters in summer when a thick cream sits on the skin.</p>
<h3>When to apply</h3>
<p>Within three minutes of towelling off, on skin that is still slightly damp. Lotion works partly by sealing in water, so a fully dry body gets less from the same bottle.</p>
$html$,
  '[{"q":"How often should I use a body scrub or exfoliating wash?","a":"Two or three times a week is enough for most people. Daily scrubbing irritates the skin and can make dryness worse, particularly in winter."},
    {"q":"Why is my body skin dry even though I moisturise?","a":"Usually the timing or the water. Apply lotion within three minutes of showering while skin is damp, and avoid very hot showers, which strip the oils faster than any lotion replaces them."},
    {"q":"What helps bumpy skin on the upper arms?","a":"That is usually keratosis pilaris. An exfoliating body wash used a few times a week, followed by a lotion, softens it. It is harmless and tends to improve with consistency rather than force."},
    {"q":"Can I use body lotion on my face?","a":"Better not to. Body lotions are richer and more heavily fragranced, which on facial skin can clog pores or cause irritation."}]'::jsonb),

( 'highlighters',
  'Highlighters',
  'Powder, liquid and stick highlighters from Christine to Fenty. What each finish does on Pakistani skin tones, and how much is too much.',
  'smart',
  '{"match":"any","conditions":[{"field":"category","op":"in","value":["Highlighters"]},{"field":"title","op":"contains","value":"highlighter"}]}'::jsonb,
  'published', 109,
  'Highlighter in Pakistan: Powder, Liquid & Stick',
  'Powder, liquid and stick highlighters available in Pakistan, from budget palettes to Fenty and Anastasia. Shades for warm and deep skin. Live prices.',
  $html$
<h2>Picking a highlighter</h2>
<p>Finish matters more than brand. A finely milled powder reads as lit-from-within; a glittery one reads as glitter, especially in daylight and in photographs taken with flash.</p>
<h3>Liquid, for skin that looks like skin</h3>
<p>Liquids blend into the base rather than sitting on top, so they survive a humid day better than powder. Iconic London Illuminator Drops ([[price:iconic-london-liquid-highlighter]]) can also be mixed into foundation for an all-over glow.</p>
<h3>Stick, for speed</h3>
<p>The easiest format to apply without a brush. Pixi On-the-Glow SuperGlow Stick ([[price:highlighter-sticks-by-pixi]]) goes straight on the cheekbone and blends with a fingertip.</p>
<h3>Powder, for control</h3>
<p>Best over a powdered base and the easiest to build slowly. The Christine 4 Colour Highlighter Kit ([[price:christine-highlighter-4-in-1-palette]]) is the affordable way to try four shades before committing, and Fenty Diamond Bomb ([[price:fenty-beauty-diamond-bomb]]) is the high-impact end.</p>
<h3>Shades for warm and deep skin</h3>
<p>Champagne and gold sit better on warm and olive undertones than icy silver, which can look grey. Deeper skin tones generally need a more pigmented formula, so liquids and richer powders beat a sheer pearl.</p>
<h3>Where to put it</h3>
<p>The top of the cheekbone, the bridge of the nose, the cupid's bow, and the inner corner of the eye. Keeping it off the outer cheek is what stops it reading as shine rather than glow.</p>
$html$,
  '[{"q":"Powder or liquid highlighter?","a":"Liquid blends into the skin and lasts better in humidity; powder is easier to control and build. On oily skin a liquid that sets usually outlasts a powder."},
    {"q":"Which highlighter shade suits Pakistani skin?","a":"Champagne and warm gold for most warm and olive undertones. Icy silver can read grey. Deeper skin tones need more pigment, so a richer formula rather than a sheer pearl."},
    {"q":"How do I stop highlighter looking glittery?","a":"Choose a finely milled formula and apply with a small brush or a fingertip, not a large fluffy brush. Build in thin layers and keep it to the high points of the face."},
    {"q":"Highlighter before or after powder?","a":"Powder highlighter goes on after setting powder. Liquid or stick goes on before, straight over foundation, so the powder does not lift it."}]'::jsonb),

( 'face-scrubs-exfoliators',
  'Face Scrubs & Exfoliators',
  'Physical scrubs and chemical exfoliating pads. Which one your skin actually needs, and how often is too often.',
  'smart',
  '{"match":"any","conditions":[{"field":"title","op":"contains","value":"scrub"},{"field":"title","op":"contains","value":"peeling"}]}'::jsonb,
  'published', 110,
  'Face Scrub & Exfoliator in Pakistan: Prices',
  'Face scrubs and exfoliating pads in Pakistan for acne-prone, dry and sensitive skin. BHA apricot, green tea and gentle rose options. Live prices.',
  $html$
<h2>Scrub or acid?</h2>
<p>A scrub removes dead skin with friction. A chemical exfoliant dissolves the bonds holding it on. For acne-prone or sensitive skin the chemical route is usually gentler, because friction on an active breakout spreads it.</p>
<h3>Acne-prone skin</h3>
<p>Salicylic acid is oil-soluble, so it clears inside the pore rather than just the surface. The BHA Exfoliant Apricot Face Scrub ([[price:st-ives-bha-apricot-face-scrub]]) and the Blackhead Clearing Green Tea &amp; Bamboo scrub ([[price:st-ives-bha-green-tea-bamboo-face-scrub]]) both pair BHA with a physical scrub.</p>
<h3>Sensitive or easily irritated skin</h3>
<p>Go gentler and less often. The Rose &amp; Aloe Face Scrub ([[price:st-ives-rose-aloe-face-scrub]]) has finer particles, and once a week is plenty.</p>
<h3>Dull or dry skin</h3>
<p>Soft Skin Avocado &amp; Honey ([[price:st-ives-avocado-honey-face-scrub]]) is the more nourishing option when the problem is dullness rather than congestion.</p>
<h3>The no-friction option</h3>
<p>Medicube Red Succinic Acid Peeling Pads ([[price:medicube-red-succinic-acid-peeling-pad]]) do the job with acid on a pad, which suits skin that reacts badly to any scrubbing.</p>
<h3>How often</h3>
<p>Once or twice a week. Daily exfoliation is the single most common way people damage their barrier, and the result looks like sensitivity, redness and more oil, not smoother skin.</p>
$html$,
  '[{"q":"How often should I exfoliate my face?","a":"Once or twice a week for most skin. Daily exfoliation damages the barrier, and the tight, red, oilier skin that follows is often mistaken for a need to exfoliate more."},
    {"q":"Is a face scrub bad for acne?","a":"Scrubbing an active breakout can spread it and worsen inflammation. A salicylic acid product, or a gentle scrub used sparingly on unbroken skin, is the safer route."},
    {"q":"Can I use a scrub and an acid serum together?","a":"Not on the same day. Pick one. Using both is a fast way to a stinging, flaky barrier that then takes weeks to settle."},
    {"q":"Should I exfoliate before or after cleansing?","a":"After. Cleanse first so the scrub is working on clean skin, then follow with moisturiser, and sunscreen if it is daytime."}]'::jsonb),

( 'toners-essences',
  'Toners & Essences',
  'Glycolic toners for texture and hydrating essences for the step after cleansing. Two different jobs that share a shelf.',
  'smart',
  '{"match":"any","conditions":[{"field":"title","op":"contains","value":"toner"},{"field":"title","op":"contains","value":"essence"},{"field":"title","op":"contains","value":"tonic"}]}'::jsonb,
  'published', 111,
  'Face Toner & Essence in Pakistan: Prices & Picks',
  'Glycolic acid toners and hydrating essences available in Pakistan. Pixi Glow Tonic, The Ordinary and COSRX snail mucin. Live prices, cash on delivery.',
  $html$
<h2>Toner and essence are not the same step</h2>
<p>An exfoliating toner removes dead skin and smooths texture. A hydrating essence adds water back. Modern toners are not the stripping astringents from the nineties, and if yours leaves your face tight, it is the wrong one.</p>
<h3>Texture, dullness and clogged pores</h3>
<p>Glycolic acid is the workhorse. Pixi Glow Tonic 5% ([[price:pixi-glow-tonic-5-glycolic-acid-toner]]) is the gentler starting point; The Ordinary 7% ([[price:the-ordinary-7-glycolic-acid-toner]]) is stronger and better once your skin is used to acids. Start twice a week, not nightly.</p>
<h3>Hydration and barrier repair</h3>
<p>COSRX Advanced Snail 96 Mucin Power Essence ([[price:cosrx-advanced-snail-96-mucin-power-essence]]) is the one people buy again, and it layers under anything. Mixsoon Bean Essence ([[price:mixsoon-bean-essence]]) is the minimal-ingredient option for reactive skin.</p>
<h3>Both jobs at once</h3>
<p>Pixi Glow Tonic Serum ([[price:pixi-glow-tonic-serum]]) is the concentrated version if you would rather not add another bottle to the routine.</p>
<h3>Order</h3>
<p>Cleanse, toner, essence, serum, moisturiser, sunscreen in the morning. If you use an acid toner at night, skip other actives that night.</p>
$html$,
  '[{"q":"What is the difference between a toner and an essence?","a":"A toner usually exfoliates or balances after cleansing. An essence is a lightweight hydrating layer that goes on afterwards. You can use both, in that order, or just the one your skin needs."},
    {"q":"Do I need a toner at all?","a":"No. It is an optional step. It earns its place if you have texture, clogged pores or dullness that cleansing alone is not fixing."},
    {"q":"How often should I use a glycolic acid toner?","a":"Start twice a week at night and build up only if your skin is comfortable. Nightly use from day one is how people end up with a stinging, flaky barrier."},
    {"q":"Can I use a toner and a serum together?","a":"Yes, toner first, then serum. Avoid stacking an acid toner with another strong active such as retinol on the same night."}]'::jsonb)

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
