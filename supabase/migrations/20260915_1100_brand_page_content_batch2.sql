-- Brand page buyer's guides, batch 2 of 2 (for now).
--
-- Batch 1 (20260915_1000) took the ten highest-earning brand pages that had
-- no content. This takes everything left that has enough catalogue to justify
-- a guide, which turns out to be eight brands, not another ten.
--
-- ── Why the batch is eight and not more ────────────────────────────────────
-- After these, every remaining brand page has ONE published product. A
-- "buyer's guide" for a single product is a product page with extra steps,
-- and padding a page to look substantial is exactly what these guides are
-- meant not to be. The floor applied here is two published products, which is
-- the point at which the page can answer a real question: which of these do
-- I need.
--
--   St. Ives          17 products   the body care range
--   Yellow Pink       10            the store's own combos and tests
--   The Ordinary       3
--   COSRX              2            major K-beauty name
--   Charlotte Tilbury  2            highest ticket in the store
--   Clearblue          2            category authority for pregnancy tests
--   Celimax            2            has revenue
--   Mixsoon            2
--
-- ── Deliberately skipped: OGX ──────────────────────────────────────────────
-- OGX has one published product today (the Argan Oil of Morocco hair mask)
-- and FIVE hair drafts waiting on photos and confirmed prices
-- (20260914_1900). Writing its guide now would mean rewriting it the week the
-- drafts go live. Write it once the shelf is real.
--
-- Same shape as batch 1: a guide that helps someone choose, four FAQs which
-- the page emits as FAQPage structured data, and [[price:slug]] tokens that
-- render at fetch time so the prices never go stale.

begin;

-- ── St. Ives ───────────────────────────────────────────────────────────────
update public.brands set
  content_html = $html$
<h2>St. Ives, and picking from seventeen of them</h2>
<p>St. Ives is the value end of body care done properly: 600ml and 650ml bottles that last a household a month rather than a week. The range splits three ways, and the scent matters less than which of the three you need.</p>
<h3>Face scrubs, and a warning</h3>
<p>The Fresh Skin Apricot Scrub ([[price:st-ives-fresh-skin-apricot-face-scrub]]) is the famous one, and it is also the most abrasive. If your skin is sensitive or acne-prone, the walnut shell in it is too rough; use the BHA Green Tea &amp; Bamboo ([[price:st-ives-bha-green-tea-bamboo-face-scrub]]) or BHA Apricot ([[price:st-ives-bha-apricot-face-scrub]]) instead, which do the work chemically with salicylic acid. Rose &amp; Aloe ([[price:st-ives-rose-aloe-face-scrub]]) and Avocado &amp; Honey ([[price:st-ives-avocado-honey-face-scrub]]) are the gentler physical options.</p>
<h3>Body wash, by what your skin is doing</h3>
<p>Itchy or tight in winter: Oatmeal &amp; Shea Butter ([[price:st-ives-oatmeal-shea-body-wash]]), which has the longest track record of any ingredient for calming itch. Bumpy upper arms: an exfoliating wash does more than a weekly scrub, so Sea Salt &amp; Pacific Kelp ([[price:st-ives-sea-salt-kelp-body-wash]]) or Pink Lemon &amp; Mandarin ([[price:st-ives-pink-lemon-mandarin-body-wash]]). Everyday: Rose Water &amp; Aloe ([[price:st-ives-rose-water-aloe-body-wash]]), Coconut Water &amp; Orchid ([[price:st-ives-coconut-water-orchid-body-wash]]) or Citrus &amp; Cherry Blossom ([[price:st-ives-citrus-cherry-blossom-body-wash]]).</p>
<h3>Lotion, and when to put it on</h3>
<p>Within three minutes of getting out of the shower, on skin still slightly damp. Lotion works partly by sealing water in, so a fully dry body gets less from the same bottle. Oatmeal &amp; Shea ([[price:st-ives-oatmeal-shea-lotion]]) for winter, Vitamin E &amp; Avocado ([[price:st-ives-vitamin-e-avocado-lotion]]) and Coconut &amp; Orchid ([[price:st-ives-coconut-orchid-lotion]]) for summer, Rose &amp; Argan ([[price:st-ives-rose-argan-lotion]]) if you want the scent to linger, Collagen &amp; Elastin ([[price:st-ives-collagen-elastin-lotion]]) for crepey skin.</p>
<h3>The one face cream</h3>
<p>Collagen &amp; Elastin Face Moisturizer ([[price:st-ives-collagen-face-moisturizer]]) is a good, cheap moisturiser. Buy it for that rather than for the collagen, which cannot pass through skin from a cream.</p>
$html$,
  faqs = '[{"q":"Is the Apricot Scrub bad for your skin?","a":"It is more abrasive than most faces need, because it exfoliates with ground walnut shell. On oily, resilient skin used gently once a week it is fine. On sensitive or acne-prone skin, use one of the BHA versions instead, which work chemically rather than by scrubbing."},
    {"q":"Which body wash for itchy winter skin?","a":"Oatmeal and Shea Butter. Oatmeal has the longest track record of any ingredient for calming itch, and the matching lotion continues it."},
    {"q":"What helps the bumps on my upper arms?","a":"That is usually keratosis pilaris. An exfoliating body wash a few times a week, followed by lotion, softens it more reliably than a weekly scrub. It is harmless and responds to consistency rather than force."},
    {"q":"When should I apply body lotion?","a":"Within three minutes of towelling off, while skin is still damp. Lotion seals water in, so applying it to fully dry skin gets you less from the same bottle."}]'::jsonb,
  updated_at = now()
where slug = 'st-ives';

-- ── Yellow Pink (own brand) ────────────────────────────────────────────────
update public.brands set
  content_html = $html$
<h2>What a Yellow Pink combo actually is</h2>
<p>Worth being straight about this, because "own brand" usually means something else. A Yellow Pink combo is not a product we manufacture. It is a set of supplements we already stock, chosen to work together for one goal and priced lower than buying each on its own. The pregnancy and ovulation tests are the exception: those are generic tests sold under our name.</p>
<h3>Trying to conceive</h3>
<p>The Couple Fertility Combo ([[price:couple-fertility-combo-his-hers-conception-support-bundle]]) covers both partners, which is the sensible approach rather than the polite one: roughly half of fertility difficulties involve a male factor. Once pregnant, the Pregnancy &amp; Prenatal Care Combo ([[price:pregnancy-prenatal-care-combo-pack-complete-maternal-health-bundle]]) is the follow-on.</p>
<h3>Testing</h3>
<p>Pregnancy Test Strips in a pack of five ([[price:pregnancy-test-strips-pack-of-5]]) are the cheapest way to test more than once, which most people end up doing. The Midstream test ([[price:midstream-pregnancy-test]]) is easier to use, and the Ovulation + Pregnancy Combo Kit ([[price:ovulation-pregnancy-test-combo-kit]]) has seven ovulation strips and two pregnancy tests for a full cycle of tracking.</p>
<h3>The other combos</h3>
<p>Women's Wellness &amp; Hormonal Balance ([[price:womens-wellness-hormonal-balance-combo-complete-female-health-bundle]]), Men's Vitality &amp; Performance ([[price:mens-vitality-performance-combo-total-male-health-bundle]]), Immunity &amp; Detox Shield ([[price:immunity-detox-shield-combo-total-body-defense-bundle]]), Strong Bones &amp; Joint Health ([[price:strong-bones-joint-health-combo-complete-skeletal-wellness-bundle]]) and Baby Care &amp; Growth Essentials ([[price:baby-care-growth-essentials-combo-complete-pediatric-nutrition-bundle]]).</p>
<h3>Expectations</h3>
<p>Supplements work over months, not days, and a combo is not a diagnosis. If something is persistently wrong, see a doctor first and use these alongside what they tell you.</p>
$html$,
  faqs = '[{"q":"Does Yellow Pink manufacture these?","a":"No. The combos are sets of supplements we already stock, chosen to work together and priced below buying each separately. The pregnancy and ovulation tests are generic tests sold under our name."},
    {"q":"Is a combo cheaper than buying the items separately?","a":"Yes, that is the point of it. If you only need one item from a combo, buy that item on its own instead."},
    {"q":"How early can a pregnancy test detect pregnancy?","a":"Most detect from the day of a missed period. Testing earlier than that gives more false negatives, which is the main reason the five-strip pack is more useful than a single test."},
    {"q":"Should both partners take something when trying to conceive?","a":"Usually yes, which is why the fertility combo covers both. Around half of fertility difficulties involve a male factor."}]'::jsonb,
  updated_at = now()
where slug = 'yellow-pink';

-- ── The Ordinary ───────────────────────────────────────────────────────────
update public.brands set
  content_html = $html$
<h2>The Ordinary, and the order to use them in</h2>
<p>The Ordinary sells actives at cost with the percentage on the label and no instructions on the box, which is either the appeal or the problem depending on how much you already know. Three are stocked, and they should not all be used on the same night.</p>
<h3>For blackheads and clogged pores</h3>
<p>Salicylic Acid 2% Solution ([[price:salicylic-acid-serum]]) is oil-soluble, so it clears a pore from the inside. Two or three nights a week to start. It does very little for dryness, so if flaking is the complaint this is the wrong bottle.</p>
<h3>For dullness and texture</h3>
<p>7% Glycolic Acid Toner ([[price:the-ordinary-7-glycolic-acid-toner]]) on a cotton pad, on the nights you are not using something else. Glycolic works on the surface; salicylic works in the pore. That is the actual difference between them.</p>
<h3>For lines and long-term texture</h3>
<p>Retinol 0.2% in Squalane ([[price:retinol-serum]]) is the lowest strength in the range, which is where to start. Retinol takes three to six months to show, and the first few weeks often look worse before they look better.</p>
<h3>The mistake almost everyone makes</h3>
<p>Buying all three and using them together. Acids plus retinol on the same night is the fastest route to a stinging, peeling face, and then to deciding none of it suits you. Pick one, give it six weeks, then add a second on alternate nights.</p>
<h3>And the part that is not optional</h3>
<p>All three make skin more sun-sensitive. Daily SPF is what makes the difference between the results holding and undoing themselves.</p>
$html$,
  faqs = '[{"q":"Can I use all three together?","a":"No, not at first, and this is the most common mistake with the brand. Acids plus retinol on the same night causes irritation. Use one for six weeks, then introduce a second on alternate nights."},
    {"q":"Salicylic acid or glycolic acid?","a":"Salicylic is oil-soluble and clears blackheads and clogged pores from inside the pore. Glycolic works on the surface for dullness and texture. Different problems, not different strengths of the same thing."},
    {"q":"Is 0.2% retinol too weak to do anything?","a":"No, it is where you should start. Higher strengths irritate more without working faster for most people, and irritation is why people quit before the three to six months it takes to show."},
    {"q":"Do I need sunscreen with these?","a":"Yes, daily. All three increase sun sensitivity, and without SPF the pigmentation and texture work undoes itself faster than the serum can build it."}]'::jsonb,
  updated_at = now()
where slug = 'the-ordinary';

-- ── COSRX ──────────────────────────────────────────────────────────────────
update public.brands set
  content_html = $html$
<h2>COSRX and snail mucin</h2>
<p>COSRX is the brand that made snail secretion filtrate a mainstream skincare ingredient. It sounds worse than it is: it is a hydrating, repairing ingredient that suits a barrier which has been over-exfoliated or is generally dry and irritated.</p>
<h3>The essence</h3>
<p>Advanced Snail 96 Mucin Power Essence ([[price:cosrx-advanced-snail-96-mucin-power-essence]]) is the product people mean when they recommend the brand. It is 96% snail mucin, it is slightly tacky going on, and that tackiness settles in a minute. Apply it to damp skin and follow with a moisturiser; on its own in dry air it does less.</p>
<h3>The cleanser</h3>
<p>Advanced Snail Mucin Gel Cleanser ([[price:cosrx-advanced-snail-mucin-gel-cleanser]]) is a low-pH gel wash, which matters more than the snail content does. A high-pH foaming cleanser is what leaves skin tight and takes the barrier with it.</p>
<h3>Who this is for</h3>
<p>Skin that is dehydrated, over-exfoliated or recovering. It is not an acne treatment and it will not fade pigmentation. If those are the goal, a salicylic acid or a niacinamide serum is the right purchase and this is the thing you use alongside it.</p>
$html$,
  faqs = '[{"q":"What does snail mucin actually do?","a":"It hydrates and supports barrier repair. It is the ingredient for dehydrated, over-exfoliated or irritated skin, not a treatment for acne or pigmentation."},
    {"q":"Is the essence meant to feel sticky?","a":"Yes, slightly, and it settles within about a minute. Applying it to damp skin and following with a moisturiser both reduce the tackiness and make it work better."},
    {"q":"Is it cruelty-free?","a":"The mucin is collected from snails without harming them, and COSRX states the process is cruelty-free. If that matters to you, plenty of hydrating alternatives use hyaluronic acid or panthenol instead."},
    {"q":"Can I use it with actives?","a":"Yes, and it pairs particularly well with them. Snail mucin is the calming step that makes a retinol or acid routine tolerable."}]'::jsonb,
  updated_at = now()
where slug = 'cosrx';

-- ── Charlotte Tilbury ──────────────────────────────────────────────────────
update public.brands set
  content_html = $html$
<h2>Two Charlotte Tilbury foundations, and which is yours</h2>
<p>Both cost the same and both are excellent. The choice is entirely about your skin type, and getting it wrong is the difference between a base that looks like skin and one that slides off by evening.</p>
<h3>Dry skin</h3>
<p>Beautiful Skin Foundation ([[price:charlotte-tilbury-beautiful-skin-foundation]]) is the hydrating one, with a luminous finish. It sits well on skin that usually shows every dry patch by lunchtime, and it does not cling to flaking.</p>
<h3>Oily skin, or a long event</h3>
<p>Airbrush Flawless ([[price:charlotte-tilbury-airbrush-flawless-foundation]]) is the matte, longer-wearing one. This is the wedding-season answer in Karachi or Lahore humidity, where a dewy base gives up after a few hours.</p>
<h3>Shade, without a counter</h3>
<p>Undertone before depth. Most Pakistani skin runs warm or olive, so a golden-based shade reads correct where a neutral or pink one goes grey. Swatch along the jawline in daylight, not on the back of your hand, and wait half an hour before deciding: some formulas oxidise and darken as they react with skin oils.</p>
<h3>Worth knowing before you spend this much</h3>
<p>A well-matched cheaper foundation beats a badly matched expensive one every time. If you are unsure of your undertone, work that out first.</p>
$html$,
  faqs = '[{"q":"Beautiful Skin or Airbrush Flawless?","a":"Beautiful Skin for dry skin and a luminous finish. Airbrush Flawless for oily skin, humidity and long events where you need it to stay put."},
    {"q":"How do I pick the shade online?","a":"Match undertone first, depth second. Warm and olive skin needs a golden base; a neutral or pink base reads ashy. Swatch on the jawline in daylight and wait half an hour."},
    {"q":"What is oxidation?","a":"A foundation darkening as it reacts with your skin oils, usually within half an hour. If a shade looked right on application and wrong later, go one shade lighter next time."},
    {"q":"Is it worth the price?","a":"The formulas are genuinely good and long-wearing. But a well-matched cheaper foundation looks better than a badly matched expensive one, so get your undertone right before spending this much."}]'::jsonb,
  updated_at = now()
where slug = 'charlotte-tilbury';

-- ── Clearblue ──────────────────────────────────────────────────────────────
update public.brands set
  content_html = $html$
<h2>Clearblue, and when to test</h2>
<p>Clearblue is the test most doctors name when asked, and the two versions here differ in how they tell you rather than in how sensitive they are.</p>
<h3>The digital one</h3>
<p>Digital Pregnancy Test with Smart Countdown ([[price:clearblue-digital-pregnancy-test]]) prints the words "Pregnant" or "Not Pregnant" on a screen. That sounds like a small thing and is not: reading a faint second line on a strip test, at six in the morning, when you badly want one answer, is where most of the confusion in home testing comes from. Three tests to a pack.</p>
<h3>The rapid one</h3>
<p>Rapid Detection Pregnancy Test ([[price:clearblue-rapid-detection-pregnancy-test]]) is the conventional two-line test, two to a pack, and cheaper per test.</p>
<h3>When to test</h3>
<p>From the day of your missed period. Testing earlier is the single biggest cause of a false negative, because hCG has not risen enough yet. First morning urine is the most concentrated and therefore the most reliable.</p>
<h3>If the result is not what you expected</h3>
<p>A negative with no period after a week is worth retesting, then worth a doctor. A positive should be confirmed with a doctor regardless, because the next steps matter and start early.</p>
<h3>Cheaper options</h3>
<p>We also stock strip tests at a fraction of the price. They are accurate when used correctly. The reason to pay for Clearblue is confidence in reading the result, not better detection.</p>
$html$,
  faqs = '[{"q":"When is the earliest I can test?","a":"From the day of your missed period for a reliable result. Some tests claim earlier, but testing before that is the single biggest cause of a false negative."},
    {"q":"Digital or the line test?","a":"Digital removes the guesswork of reading a faint line, which is where most home-testing confusion comes from. The line test is cheaper per test and just as sensitive."},
    {"q":"Does the time of day matter?","a":"Yes. First morning urine is the most concentrated, so it gives the most reliable early result."},
    {"q":"Are cheaper strip tests accurate?","a":"Yes, when used correctly. What you pay extra for with Clearblue is certainty in reading the result, not better detection."}]'::jsonb,
  updated_at = now()
where slug = 'clearblue';

-- ── Celimax ────────────────────────────────────────────────────────────────
update public.brands set
  content_html = $html$
<h2>Celimax, the two to know</h2>
<p>Celimax is a smaller Korean brand that does single-idea products well. The two stocked here happen to be a good pairing: one protects during the day, the other works overnight.</p>
<h3>Day</h3>
<p>Pore + Dark Spot Brightening Care Sunscreen ([[price:celimax-pore-dark-spot-brightening-care-sunscreen]]) is SPF50+ PA++++ with niacinamide in the formula, so it protects and works on pigmentation in the same step. That combination matters more than it sounds: pigmentation treatment is undone by sun faster than any serum repairs it, so an active sunscreen is doing two jobs at once.</p>
<h3>Night</h3>
<p>The Vita-A Retinal Shot Tightening Booster ([[price:celimax-retinal-shot-tightening-booster]]) is retinal, not retinol. Retinal converts to the active form in fewer steps, which makes it stronger and faster, and also more likely to irritate. Two nights a week to start, and not on the same night as an acid.</p>
<h3>Using them together</h3>
<p>This is the classic pairing and the order is not optional: retinal at night makes skin more sun-sensitive, so the sunscreen in the morning is what stops the routine working against itself.</p>
$html$,
  faqs = '[{"q":"Retinal or retinol, what is the difference?","a":"Retinal converts to the skin-active form in fewer steps than retinol, so it works faster and is stronger. It also irritates more easily, which is why two nights a week is the right starting point."},
    {"q":"Why does a sunscreen have niacinamide in it?","a":"Because pigmentation work is undone by sun faster than a serum can repair it. A sunscreen carrying a brightening active does both jobs in the step you will actually do every day."},
    {"q":"Can I use the retinal booster every night?","a":"Not at first. Start at two nights a week and build up only if your skin stays comfortable. Do not pair it with an acid on the same night."},
    {"q":"Do I need both?","a":"The sunscreen is the one to buy first. Sun protection does more for pigmentation and ageing than any night treatment, and it is the step with the most evidence behind it."}]'::jsonb,
  updated_at = now()
where slug = 'celimax';

-- ── Mixsoon ────────────────────────────────────────────────────────────────
update public.brands set
  content_html = $html$
<h2>Mixsoon and the bean</h2>
<p>Mixsoon built its reputation on one ingredient: fermented soybean. The pitch is minimalism, which here means short ingredient lists and a formula that does not fight anything else you are using.</p>
<h3>The essence</h3>
<p>Bean Essence ([[price:mixsoon-bean-essence]]) is the product the brand is known for. Fermented soybean is a gentle exfoliant and hydrator at once, which is unusual: it smooths texture without the sting of an acid, so it suits skin that reacts badly to glycolic or salicylic.</p>
<h3>The cream</h3>
<p>Bean Cream ([[price:mixsoon-bean-cream]]) is the same idea in a moisturiser, and it is the one to use if the essence alone leaves your skin wanting more in winter.</p>
<h3>Who this suits</h3>
<p>Sensitive skin, and anyone whose routine has become too many actives. The bean products are the step that does not need to be timed around anything else, which is the practical reason to own one.</p>
<h3>What not to expect</h3>
<p>This is gentle, so it is slow. If you want visible change on deep pigmentation in six weeks, a niacinamide or tranexamic acid serum is the honest answer and this is what you use alongside it.</p>
$html$,
  faqs = '[{"q":"What does fermented soybean do?","a":"It gently exfoliates and hydrates at the same time, smoothing texture without the sting of an acid. It is the option for skin that reacts badly to glycolic or salicylic."},
    {"q":"Essence or cream?","a":"The essence is the one the brand is known for and the one to start with. Add the cream if the essence alone leaves your skin wanting more, particularly in winter."},
    {"q":"Can I use it with my other actives?","a":"Yes. That is the main practical reason to own it: it does not need timing around anything else in the routine."},
    {"q":"How long before I see a difference?","a":"It is gentle, so it is slow. Expect texture and comfort to improve over weeks. For deep pigmentation, a targeted serum will do more and this works alongside it."}]'::jsonb,
  updated_at = now()
where slug = 'mixsoon';

commit;
