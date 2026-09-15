-- Point the hair guides at the new collections.
--
-- The three collections from 20260915_2000 are in the sitemap and the footer,
-- and that is all: not one of the eight hair articles linked to a collection.
-- Four pointed at /category/hair-care and four at nothing. The store's hair
-- content is where its hair readers are (best-shampoo-in-pakistan alone takes
-- 224 real sessions a quarter), so these are the links that decide whether the
-- new pages are ever crawled with intent or reached by a shopper.
--
-- Each link goes to the narrowest page that answers the article, with
-- /category/hair-care kept as the wider browse where the sentence already had
-- one. Nothing is repointed away from a product.
--
-- The keratin guide also had a mislabelled call to action. The button read
-- "Shop Set and Touch Keratin Repair Shampoo" while pointing at the OGX argan
-- hair mask: the href was repointed when the Set and Touch line was
-- unpublished and the label was left behind, so a reader clicking for a
-- keratin shampoo landed on a mask. Fixed here because it was found here.

update public.blog_posts set body = replace(body,
'or browse the full <a href="/category/hair-care">hair care range</a> for masks, oils and minoxidil.',
'or browse every <a href="/collection/shampoo-conditioner">shampoo and conditioner</a> we carry. If flaking is the whole problem, the <a href="/collection/anti-dandruff">anti-dandruff shelf</a> is the short list, and the full <a href="/category/hair-care">hair care range</a> has the masks, oils and minoxidil.'),
updated_at = now()
where slug = 'best-shampoo-in-pakistan';

update public.blog_posts set body = replace(body,
'and browse the rest of the <a href="/category/hair-care">hair care range</a> for shampoos, scalp oils and treatments.',
'and browse every <a href="/collection/shampoo-conditioner">shampoo and conditioner</a> we carry, or the rest of the <a href="/category/hair-care">hair care range</a> for scalp oils and treatments.'),
updated_at = now()
where slug = 'hair-conditioner-guide-pakistan';

update public.blog_posts set body = replace(body,
'and the rest of our <a href="/category/hair-care">hair care range</a> has the oils, anti-dandruff shampoos and Minoxin 5% to build on it.',
'and the <a href="/collection/hair-growth">hair growth and hair fall shelf</a> has what to build on it: Minoxin 5%, the multi-peptide density serum, and the rosemary and castor oils. The wider <a href="/category/hair-care">hair care range</a> covers the shampoos and masks.'),
updated_at = now()
where slug = 'hair-growth-oil-pakistan-guide';

update public.blog_posts set body = replace(body,
'<p>Browse all <a href="/category/hair-care">hair care</a> and <a href="/shop?taxon=wellness">wellness</a>.</p>',
'<p>Browse the <a href="/collection/hair-growth">hair growth and hair fall</a> shelf for the treatments themselves, all <a href="/category/hair-care">hair care</a>, or <a href="/shop?taxon=wellness">wellness</a> for the supplements side.</p>'),
updated_at = now()
where slug = 'how-to-reduce-hair-fall-pakistan';

-- The four articles that closed on a single product now offer the shelf behind
-- it as well, so a reader who wants that product's alternatives has somewhere
-- to go other than back to Google.
update public.blog_posts set body = replace(body,
'<a class="blog-cta" href="/product/cerave-anti-dandruff-hydrating-shampoo">Shop CeraVe Anti-Dandruff Hydrating Shampoo →</a>',
'<p>Comparing options? The <a href="/collection/anti-dandruff">anti-dandruff shelf</a> is all three we stock side by side, and every <a href="/collection/shampoo-conditioner">shampoo and conditioner</a> is one page further.</p>

<a class="blog-cta" href="/product/cerave-anti-dandruff-hydrating-shampoo">Shop CeraVe Anti-Dandruff Hydrating Shampoo →</a>'),
updated_at = now()
where slug = 'dandruff-treatment-shampoos-home-remedies-pakistan';

update public.blog_posts set body = replace(body,
'<a class="blog-cta" href="/product/minoxidil">Shop Minoxin Plus Minoxidil 5% →</a>',
'<p>If you would rather start without a medicine, or want something to run alongside it, the <a href="/collection/hair-growth">hair growth and hair fall shelf</a> has the multi-peptide density serum and the scalp oils.</p>

<a class="blog-cta" href="/product/minoxidil">Shop Minoxin Plus Minoxidil 5% →</a>'),
updated_at = now()
where slug = 'minoxidil-for-hair-loss-pakistan';

update public.blog_posts set body = replace(body,
'<a class="blog-cta" href="/shop">Shop All Supplements →</a>',
'<p>Biotin works from the inside. For the topical half of the same problem, the <a href="/collection/hair-growth">hair growth and hair fall shelf</a> has minoxidil, the multi-peptide density serum and the scalp oils.</p>

<a class="blog-cta" href="/shop">Shop All Supplements →</a>'),
updated_at = now()
where slug = 'biotin-hair-loss-pakistan-women-supplement-guide';

update public.blog_posts set body = replace(body,
'<a class="blog-cta" href="/product/argan-oil-of-morocco-hair-mask">Shop Set and Touch Keratin Repair Shampoo →</a>',
'<p>Keratin aftercare is mostly about washing gently and conditioning hard. Every <a href="/collection/shampoo-conditioner">shampoo and conditioner</a> we carry is on one page, and the OGX argan oil pair is the usual choice after a treatment.</p>

<a class="blog-cta" href="/product/argan-oil-of-morocco-hair-mask">Shop the OGX Argan Oil of Morocco Hair Mask →</a>'),
updated_at = now()
where slug = 'keratin-treatment-for-hair-cost-aftercare-pakistan';
