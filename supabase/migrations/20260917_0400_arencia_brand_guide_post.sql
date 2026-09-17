-- Arencia brand guide.
--
-- The brand-guide posts (Medicube, Anua, CeraVe, Beauty of Joseon, SKIN1004)
-- are the store's biggest AI-referral entry points, and Arencia went live on
-- 17 Sep with seven products and nothing pointing at the shelf. Same shape
-- as the other guides: which product for which skin, how to pair them,
-- prices via [[price:slug]] tokens, FAQ, brand-page CTA.
--
-- Hero: public/blog-heroes/arencia-products-guide-pakistan.webp, generated
-- still life (no people), 1216x688, ships in the same commit. image_url is
-- set here because this migration is applied only after that deploy is live.
--
-- reviewer_id is left null on purpose: the assignment trigger credits a
-- board doctor by topic on insert, the same path the admin form uses.

begin;

insert into public.blog_posts
  (slug, title, seo_title, excerpt, category, topic, author, date, read_time, featured, image_url, body)
values (
  'arencia-products-guide-pakistan',
  'Arencia in Pakistan: Which Rice Mochi Cleanser Is Right for You ([[year]] Guide)',
  'Arencia in Pakistan: Rice Mochi Cleanser Guide',
  'A plain guide to Arencia in Pakistan: the five rice mochi cleansers, the Pore Melt cleansing oil and the Vitamin C Booster Shot, which one suits your skin, how to double cleanse, and current prices.',
  'Skincare', 'Skincare', 'Yellow Pink Editorial', '2026-09-17', '9 min read', false,
  '/blog-heroes/arencia-products-guide-pakistan.webp',
  E'<p>Arencia is the Korean brand behind the rice mochi cleanser, the soft, stretchy face wash that looks like a scoop of dough and rinses like a foam. It has become one of the best-known cleanser formats in Korea, and it has just arrived at Yellow Pink. This guide covers the seven Arencia products we stock, which cleanser suits which skin, how to pair the oil and the cleanser for a proper double cleanse, and what each costs in Pakistan.</p>

<div class="blog-picks"><p><strong>Shop the picks in this guide</strong></p><ul>
<li><a class="blog-product-link" href="/product/arencia-fresh-green-rice-mochi-cleanser">Arencia Fresh Green Rice Mochi Cleanser 120g</a>, [[price:arencia-fresh-green-rice-mochi-cleanser]], the original, for normal to combination skin</li>
<li><a class="blog-product-link" href="/product/arencia-fresh-blue-hyssop-rice-mochi-cleanser">Arencia Fresh Blue Hyssop Rice Mochi Cleanser 120g</a>, [[price:arencia-fresh-blue-hyssop-rice-mochi-cleanser]], clay and hyssop for oily, congested skin</li>
<li><a class="blog-product-link" href="/product/arencia-black-tea-yuzu-rice-mochi-cleanser">Arencia Black Tea &amp; Yuzu Rice Mochi Cleanser 120g</a>, [[price:arencia-black-tea-yuzu-rice-mochi-cleanser]], charcoal for blackheads</li>
<li><a class="blog-product-link" href="/product/arencia-calendula-rice-mochi-cleanser">Arencia Calendula Rice Mochi Cleanser 120g</a>, [[price:arencia-calendula-rice-mochi-cleanser]], for dry, sensitive or reddened skin</li>
<li><a class="blog-product-link" href="/product/arencia-rice-mucin-cleanser">Arencia Rice Mucin Cleanser 120g</a>, [[price:arencia-rice-mucin-cleanser]], the hydrating one for dull, dehydrated skin</li>
<li><a class="blog-product-link" href="/product/arencia-pore-melt-mochi-cleansing-oil">Arencia Pore Melt Mochi Cleansing Oil 200ml</a>, [[price:arencia-pore-melt-mochi-cleansing-oil]], the first step of a double cleanse</li>
<li><a class="blog-product-link" href="/product/arencia-vitamin-c-booster-shot">Arencia Vitamin C Booster Shot Serum 30ml</a>, [[price:arencia-vitamin-c-booster-shot]], 5% stabilised vitamin C with glutathione</li>
</ul></div>

<h2 class="wp-block-heading">What a rice mochi cleanser actually is</h2>
<p>Most face washes are a gel or a cream. Arencia kneads rice powder and rice extract into a dough, ferments it for 72 hours at low temperature with around 30 plant ingredients, and sells it in a jar. You pinch off a fingertip-sized piece, add water, and it turns into a low, creamy foam.</p>
<p>Two things follow from that. The foam does not come from sulfates, so it cleans without the tight, squeaky feeling a strong foaming wash leaves behind. And the fine rice powder gives a very mild polish as you massage, enough to lift dead skin daily without being an exfoliant in the acid sense.</p>
<p>The texture is also why the range has a second use: apply a thicker layer and leave it for three to five minutes, and every one of the cleansers works as a wash-off mask.</p>

<h2 class="wp-block-heading">Which Arencia cleanser for which skin</h2>
<p>Arencia makes five versions of the cleanser and they are not interchangeable. The base is the same; the added ingredients decide who each is for.</p>
<figure class="wp-block-table"><table><thead><tr><th>Your skin</th><th>Reach for</th><th>Why</th></tr></thead><tbody>
<tr><td>Normal, combination, gets congested</td><td><a class="blog-product-link" href="/product/arencia-fresh-green-rice-mochi-cleanser">Fresh Green</a></td><td>The original. Green tea, mung bean and witch hazel. Clinically tested on seven skin measures in a single wash.</td></tr>
<tr><td>Oily, large pores, shiny by noon</td><td><a class="blog-product-link" href="/product/arencia-fresh-blue-hyssop-rice-mochi-cleanser">Fresh Blue Hyssop</a></td><td>Bentonite clay pulls sebum out, hyssop and chaga keep it from feeling stripped.</td></tr>
<tr><td>Blackheads on the nose and chin</td><td><a class="blog-product-link" href="/product/arencia-black-tea-yuzu-rice-mochi-cleanser">Black Tea &amp; Yuzu</a></td><td>Charcoal and fermented black tea. The deepest-cleaning of the five.</td></tr>
<tr><td>Dry, sensitive, goes red after washing</td><td><a class="blog-product-link" href="/product/arencia-calendula-rice-mochi-cleanser">Calendula</a></td><td>Calendula, heartleaf and cactus extract. The softest of the range.</td></tr>
<tr><td>Dehydrated, dull, tight after cleansing</td><td><a class="blog-product-link" href="/product/arencia-rice-mucin-cleanser">Rice Mucin</a></td><td>Nearly 10% fermented rice extract, three weights of hyaluronic acid, niacinamide.</td></tr>
</tbody></table></figure>
<p>If you are unsure, Fresh Green is the safe first jar. Skin that is clearly oily goes to Blue Hyssop; skin that stings with an ordinary face wash goes to Calendula.</p>

<h2 class="wp-block-heading">The products, one by one</h2>

<h3 class="wp-block-heading">Fresh Green Rice Mochi Cleanser</h3>
<p>This is the one Arencia is known for, and the one the brand itself puts forward as its dermatologist-recommended pick. Green tea for antioxidants, rice water and rice powder for the polish, mung bean to soothe and witch hazel to tighten the look of pores. In Arencia''s own testing a single wash improved pore congestion, blackheads, surface texture and how well skin absorbed the products that followed. It suits most people who are not especially dry or especially oily. <a class="blog-product-link" href="/product/arencia-fresh-green-rice-mochi-cleanser">Fresh Green, 120g</a>, [[price:arencia-fresh-green-rice-mochi-cleanser]].</p>

<h3 class="wp-block-heading">Fresh Blue Hyssop Rice Mochi Cleanser</h3>
<p>The oily-skin version. Bentonite clay draws sebum out of the pore, and the reason it does not leave skin tight the way a clay wash usually does is the chaga mushroom and black barley extracts, which hold moisture while the clay works. Hyssop calms the redness that often comes with oily, congested skin. Used thick, it is a very good clay mask for the T-zone. <a class="blog-product-link" href="/product/arencia-fresh-blue-hyssop-rice-mochi-cleanser">Fresh Blue Hyssop, 120g</a>, [[price:arencia-fresh-blue-hyssop-rice-mochi-cleanser]].</p>

<h3 class="wp-block-heading">Black Tea &amp; Yuzu Rice Mochi Cleanser</h3>
<p>Built around blackheads. Charcoal draws out what is sitting in the pore, fermented black tea brings antioxidants, and yuzu adds a light brightening effect. It is the deepest-cleaning cleanser in the range, so it is best for oily and combination skin, and best used on the nose, chin and forehead. Dry skin should keep it to a weekly mask on the nose rather than a daily wash. No cleanser removes blackheads in one go; this one loosens the oxidised sebum that makes them dark and, used consistently, keeps pores clearer. Pair it with a <a href="/blog/salicylic-acid-for-acne-pakistan">BHA product</a> for faster results. <a class="blog-product-link" href="/product/arencia-black-tea-yuzu-rice-mochi-cleanser">Black Tea &amp; Yuzu, 120g</a>, [[price:arencia-black-tea-yuzu-rice-mochi-cleanser]].</p>

<h3 class="wp-block-heading">Calendula Rice Mochi Cleanser</h3>
<p>For skin that goes tight or red after washing. Calendula soothes visible redness, heartleaf (houttuynia) is the K-beauty standard for reactive skin, and cactus stem extract holds water in the barrier so the skin does not dry out between cleansing and moisturising. It is the softest formula of the five, and the right daily wash for anyone on tretinoin or a strong acid. <a class="blog-product-link" href="/product/arencia-calendula-rice-mochi-cleanser">Calendula, 120g</a>, [[price:arencia-calendula-rice-mochi-cleanser]].</p>

<h3 class="wp-block-heading">Rice Mucin Cleanser</h3>
<p>Where the other four focus on clearing, this one focuses on putting moisture back. Fermented rice extract at 97,500ppm is the headline, backed by three molecular weights of hyaluronic acid, beta-glucan, niacinamide and panthenol, plus a small amount of snail secretion filtrate, hence the name. The skin is left plump rather than squeaky. It suits every skin type and is the pick for dehydrated, dull or mature skin, and for oily skin that is dehydrated underneath, which is more common than people think. <a class="blog-product-link" href="/product/arencia-rice-mucin-cleanser">Rice Mucin, 120g</a>, [[price:arencia-rice-mucin-cleanser]].</p>

<h3 class="wp-block-heading">Pore Melt Mochi Cleansing Oil</h3>
<p>A cleansing oil is the only thing that reliably removes sunscreen and long-wear makeup, and most of them clog pores while doing it. Pore Melt is formulated without 29 known pore-clogging ingredients, checked against the same comedogenicity database dermatologists use, so it is safe for acne-prone skin. Olive oil does the dissolving; rice amino acids, cica and ceramide NP look after the barrier. Add water and it turns milky and rinses off without a film. <a class="blog-product-link" href="/product/arencia-pore-melt-mochi-cleansing-oil">Pore Melt, 200ml</a>, [[price:arencia-pore-melt-mochi-cleansing-oil]].</p>

<h3 class="wp-block-heading">Vitamin C Booster Shot</h3>
<p>The one non-cleanser we stock. A vitamin C serum in a sealed tube rather than a dropper bottle, which keeps the vitamin C away from air and light for the whole 30ml. Arencia pairs 3-O-ethyl ascorbic acid at 5%, a stable form that does not sting, with a small amount of pure vitamin C, then glutathione and vitamin E as antioxidants, niacinamide for tone and panthenol to keep it comfortable. Start every other day; brightness shows in two to three weeks, dark spots take six to eight and only with daily sunscreen. <a class="blog-product-link" href="/product/arencia-vitamin-c-booster-shot">Vitamin C Booster Shot, 30ml</a>, [[price:arencia-vitamin-c-booster-shot]]. If you want to compare it with other options, our <a href="/blog/best-vitamin-c-serum-pakistan">vitamin C serum guide</a> covers the field.</p>

<h2 class="wp-block-heading">How to double cleanse with Arencia</h2>
<p>If you wear sunscreen, and you should, a foaming cleanser on its own leaves a layer of it behind. That layer is what clogs pores over time. The fix is two steps at night: an oil first, then a water-based cleanser.</p>
<ol class="wp-block-list">
<li><strong>Oil, on a dry face.</strong> Pump Pore Melt two or three times into dry hands and massage over a dry face for 30 to 60 seconds, working over the eyes, the hairline and anywhere sunscreen sits.</li>
<li><strong>Emulsify.</strong> Wet your hands and keep massaging until the oil turns milky, then rinse with lukewarm water.</li>
<li><strong>Rice mochi cleanser.</strong> A fingertip-sized piece, lathered with water, massaged for about a minute, rinsed. Pick the version from the table above.</li>
</ol>
<p>In the morning, the mochi cleanser alone is enough. Follow with your usual serum, moisturiser and SPF; the <a href="/blog/skincare-routine-order-pakistan">routine order guide</a> covers what goes where.</p>

<h2 class="wp-block-heading">Two ways to use the jar</h2>
<p>Every Arencia cleanser is a daily wash and a weekly mask in the same jar. As a wash, use a small amount and rinse straight away. As a mask, once or twice a week, apply a thicker layer to the areas that need it, leave for three to five minutes, then rinse. Blue Hyssop and Black Tea &amp; Yuzu are the two worth masking with for pores; Calendula is the one to mask with when skin is irritated.</p>

<h2 class="wp-block-heading">Is Arencia worth it in Pakistan?</h2>
<p>At [[price:arencia-fresh-green-rice-mochi-cleanser]] for 120g, a jar costs more than a local foaming wash and about the same as the other imported cleansers we stock. It also goes further: the foam comes from the rice, not from a large volume of product, so a jar lasts most people two to three months of twice-daily use. If you have a specific skin complaint that a cheap face wash keeps making worse, tight dryness or persistent blackheads, the matched version is worth the difference. If your skin is easy and any cleanser works, it is a pleasant upgrade rather than a necessary one.</p>

<h2 class="wp-block-heading">Frequently asked questions</h2>
<h3 class="wp-block-heading">Which Arencia cleanser should I buy first?</h3>
<p><a class="blog-product-link" href="/product/arencia-fresh-green-rice-mochi-cleanser">Fresh Green</a>, unless your skin is clearly oily (Blue Hyssop), blackhead-prone (Black Tea &amp; Yuzu), dry or sensitive (Calendula) or dehydrated (Rice Mucin).</p>
<h3 class="wp-block-heading">Does it foam?</h3>
<p>Softly. The foam comes from the rice base rather than sulfates, so it is lower and creamier than a typical face wash. That is normal, not a sign you have used too little.</p>
<h3 class="wp-block-heading">Does the rice mochi cleanser remove makeup?</h3>
<p>Light makeup and sweat, yes. Sunscreen and long-wear makeup need the Pore Melt oil first.</p>
<h3 class="wp-block-heading">Is it fragrance free?</h3>
<p>Arencia does not add synthetic perfume; the light scent comes from the plant extracts and the fermented rice base. If you are very fragrance-sensitive, patch test Calendula first.</p>
<h3 class="wp-block-heading">Can I use it every day?</h3>
<p>Yes, morning and night. Black Tea &amp; Yuzu is the exception for dry or combination skin, which does better alternating it with a gentler wash.</p>
<h3 class="wp-block-heading">Does the Rice Mucin cleanser contain snail?</h3>
<p>A small amount of snail secretion filtrate alongside the rice. If you avoid animal-derived ingredients, choose Calendula instead.</p>
<h3 class="wp-block-heading">How long does a jar last?</h3>
<p>Two to three months at twice a day. A fingertip-sized piece is enough for the whole face.</p>
<h3 class="wp-block-heading">Is the Arencia sold here authentic?</h3>
<p>Yes. Every Arencia product at Yellow Pink is genuine and imported, with cash on delivery across Pakistan.</p>

<h2 class="wp-block-heading">The bottom line</h2>
<p>Pick the cleanser by your skin, not by the colour of the jar: Fresh Green for most people, Blue Hyssop for oil, Black Tea &amp; Yuzu for blackheads, Calendula for sensitivity, Rice Mucin for dehydration. Add Pore Melt at night if you wear sunscreen, and the Vitamin C Booster Shot if dullness is the complaint.</p>
<p>Browse the full range on our <a class="blog-product-link" href="/brand/arencia">Arencia brand page</a>.</p><a class="blog-cta" href="/brand/arencia">Shop all Arencia →</a>'
);

commit;
