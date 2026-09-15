-- Merchandise Hair Care now that it is a real shelf.
--
-- The category went from 5 published products to 14 on 14-15 Sep, and nothing
-- downstream was updated to match. The only hair collection is /collection/
-- hair-care, whose copy still describes the old shelf ("oils, masks and growth
-- treatments ... rosemary oil, minoxidil and deep conditioning"), with no
-- mention of a shampoo or a conditioner. Nothing else points at hair at all.
--
-- ── Sized against demand, not guessed ──────────────────────────────────────
-- Semrush, pk database, monthly volume with keyword difficulty:
--
--   shampoo               6,600  KD 17      anti dandruff shampoo  4,400  KD 17
--   keratin shampoo       5,400  KD 13      dandruff shampoo       3,600  KD 23
--   conditioner           3,600  KD 21      best shampoo/dandruff    260  KD 37
--   biotin shampoo        2,400  KD 23      ------------------------------
--   hair conditioner      1,300  KD 15      anti-dandruff total    8,260
--   hair fall shampoo       880  KD 13
--   ------------------------------          hair growth oil        4,400  KD 23
--   shampoo + conditioner 20,180            minoxidil              4,400  KD 66
--                                           hair oil               3,600  KD 25
--                                           best hair oil in pk    1,600  KD  9
--                                           ------------------------------
--                                           hair growth total     14,000
--
-- The store's own Search Console agrees on where the demand is and shows it
-- is all being wasted: "best hair oil in pakistan" 110 impressions at position
-- 57, "best dandruff cure" 51 at position 39, the hair-oil family ~403
-- impressions in total, every one of them zero clicks. There is nothing to
-- click through to, because there is no page for any of it.
--
-- ── Why three collections and not six ──────────────────────────────────────
-- Batch 3 set the rule: build where there is volume AND a real shelf, defer
-- where the shelf is thin. Applying it here:
--
--   BUILD  shampoo + conditioner  7 products   ~20,180/mo
--   BUILD  hair growth            7 products   ~14,000/mo
--   BUILD  anti-dandruff          3 products    ~8,260/mo
--   DEFER  hair serum   5,400/mo, KD 12, but ONE product on the shelf
--   DEFER  hair mask      880/mo, one product
--   DEFER  argan oil    6,600/mo, KD 48 on the head term, 3 products
--
-- Anti-dandruff is built at three products where batch 3 deferred concealer at
-- four, because the intent is exact and the three are the answer: CeraVe's
-- pyrithione zinc pair and Kerium DS. A shopper typing "anti dandruff shampoo"
-- wants precisely these, not a longer list.
--
-- Shampoo and conditioner are one page rather than two. Split, they would be a
-- four-product page and a three-product page; together they are seven, and the
-- shopper buying a shampoo is the shopper buying the matching conditioner.
--
-- ── Membership by tag, curated by slug ─────────────────────────────────────
-- Same reasoning as batch 3: the smart-rule engine matches a product's NAME
-- only, tags feed the /shop facet for free, and staff can add a product to a
-- collection from the Tags box with no migration. Curated by slug so a rename
-- fails loudly (no row inserted) rather than quietly mis-tagging.

begin;

-- ── 1. Tags ────────────────────────────────────────────────────────────────
insert into public.product_tags (slug, name) values
  ('shampoo',       'Shampoo'),
  ('conditioner',   'Conditioner'),
  ('anti-dandruff', 'Anti-Dandruff'),
  ('hair-growth',   'Hair Growth')
on conflict (slug) do nothing;

-- ── 2. Membership ──────────────────────────────────────────────────────────
insert into public.product_tag_map (product_id, tag_id)
select p.id, t.id
from (values
  -- Shampoo
  ('shampoo',       'cerave-anti-dandruff-hydrating-shampoo'),
  ('shampoo',       'la-roche-posay-kerium-ds-anti-dandruff-shampoo'),
  ('shampoo',       'ogx-argan-oil-of-morocco-shampoo'),
  ('shampoo',       'ogx-biotin-collagen-shampoo'),
  -- Conditioner
  ('conditioner',   'cerave-anti-dandruff-hydrating-conditioner'),
  ('conditioner',   'ogx-argan-oil-of-morocco-conditioner'),
  ('conditioner',   'ogx-biotin-collagen-conditioner'),
  -- Anti-dandruff. The conditioner belongs here: it carries the same
  -- pyrithione zinc, and a medicated wash followed by an ordinary conditioner
  -- is how people undo the course.
  ('anti-dandruff', 'cerave-anti-dandruff-hydrating-shampoo'),
  ('anti-dandruff', 'cerave-anti-dandruff-hydrating-conditioner'),
  ('anti-dandruff', 'la-roche-posay-kerium-ds-anti-dandruff-shampoo'),
  -- Hair growth. The OGX biotin pair sits here as well as under shampoo: it
  -- is what "biotin shampoo" (2,400/mo) is looking for.
  ('hair-growth',   'minoxidil'),
  ('hair-growth',   'the-ordinary-multi-peptide-hair-density-serum'),
  ('hair-growth',   'rosemary-oil'),
  ('hair-growth',   'castor-oil'),
  ('hair-growth',   'hair-growth-oil'),
  ('hair-growth',   'ogx-biotin-collagen-shampoo'),
  ('hair-growth',   'ogx-biotin-collagen-conditioner')
) as m(tag_slug, product_slug)
join public.products p    on p.slug = m.product_slug
join public.product_tags t on t.slug = m.tag_slug
on conflict do nothing;

-- ── 3. Collections ─────────────────────────────────────────────────────────
insert into public.collections
  (slug, title, description, type, rules, status, sort_order, seo_title, seo_description, content_html, faqs)
values

( 'shampoo-conditioner',
  'Shampoo & Conditioner',
  'Four shampoos and three matching conditioners. CeraVe and La Roche-Posay for a flaking scalp, OGX argan oil for dry or coloured lengths, and OGX biotin and collagen for hair that has gone limp.',
  'smart',
  '{"match":"any","conditions":[{"field":"tag","op":"in","value":["shampoo","conditioner"]}]}'::jsonb,
  'published', 120,
  'Shampoo & Conditioner in Pakistan: Prices & Picks',
  'Imported shampoos and conditioners in Pakistan from CeraVe, La Roche-Posay and OGX. Anti-dandruff, argan oil and biotin, which one suits your scalp, live prices and cash on delivery.',
  $html$
<h2>Buy for your scalp, not your hair</h2>
<p>This is the one decision that matters and most people get it backwards. Shampoo is for the scalp. Conditioner is for the lengths. If your problem is flaking, itching or oiliness, the shampoo is the product to change. If your problem is dryness, frizz, split ends or colour fading, the shampoo will not fix it and the conditioner will do most of the work.</p>
<h3>If your scalp flakes</h3>
<p>Start with the CeraVe Anti-Dandruff Hydrating Shampoo ([[price:cerave-anti-dandruff-hydrating-shampoo]]). It carries pyrithione zinc, which deals with the yeast behind most dandruff, in a base gentle enough to use long term. If a few weeks of it has not cleared things, La Roche-Posay Kerium DS ([[price:la-roche-posay-kerium-ds-anti-dandruff-shampoo]]) adds salicylic acid to lift scale that is already stuck down, and is meant as a short course rather than a permanent shampoo.</p>
<h3>If your hair is dry, frizzy or coloured</h3>
<p>The OGX Renewing + Argan Oil of Morocco pair ([[price:ogx-argan-oil-of-morocco-shampoo]] and [[price:ogx-argan-oil-of-morocco-conditioner]]) is the straightforward answer, and the conditioner is the half doing the work. Argan oil sits on the hair shaft and smooths the cuticle, which is what makes hair look glossy rather than fluffy in Pakistani humidity.</p>
<h3>If your hair has gone thin or limp</h3>
<p>OGX Thick &amp; Full + Biotin &amp; Collagen ([[price:ogx-biotin-collagen-shampoo]] and [[price:ogx-biotin-collagen-conditioner]]) coats each strand so it behaves as though it were thicker. Worth being clear about what that means: it changes how hair looks and feels from the first wash, and it does not grow new hair. If the goal is regrowth rather than volume, that is a scalp treatment, not a shampoo.</p>
<h3>Do you have to buy the matching conditioner?</h3>
<p>No. Brands pair them because it sells two bottles. The exception is a medicated anti-dandruff wash, where the matching conditioner is formulated not to redeposit what the shampoo just removed, which is why the CeraVe conditioner ([[price:cerave-anti-dandruff-hydrating-conditioner]]) exists.</p>
<h3>Where the conditioner goes</h3>
<p>Mid-length to ends, never the scalp. Conditioner on the roots is the most common cause of hair that looks greasy by the second day, and people usually respond by washing more often, which makes it worse.</p>
$html$,
  $faq$[{"q":"How often should I wash my hair?","a":"Whatever keeps your scalp comfortable. Every day is fine if your scalp is oily, and a medicated anti-dandruff shampoo is the exception, since those are used two or three times a week on a course rather than daily."},
    {"q":"Are sulfates bad for hair?","a":"For most people, no. Sulfates are just cleansers and they rinse off. They do fade hair colour faster and can be drying on already dry hair, so a sulfate-free wash is worth it if you colour your hair, not because sulfates are harmful."},
    {"q":"Can I use conditioner without shampoo?","a":"Yes, and plenty of people with curly or very dry hair do exactly that between washes. Just keep it off the scalp."},
    {"q":"Will changing shampoo stop my hair fall?","a":"Very unlikely. Shampoo sits on the scalp for a minute and rinses away. Hair fall is usually hormonal, nutritional or stress-related, and the treatments with evidence behind them are leave-on scalp products, not washes."}]$faq$::jsonb),

( 'anti-dandruff',
  'Anti-Dandruff',
  'The three dermatology anti-dandruff products on the shelf: CeraVe shampoo and conditioner with pyrithione zinc, and La Roche-Posay Kerium DS for flaking that an everyday wash has not shifted.',
  'smart',
  '{"match":"any","conditions":[{"field":"tag","op":"in","value":["anti-dandruff"]}]}'::jsonb,
  'published', 121,
  'Anti-Dandruff Shampoo in Pakistan: What Actually Works',
  'Anti-dandruff shampoos in Pakistan with pyrithione zinc and salicylic acid, from CeraVe and La Roche-Posay. How long a course takes, what to use afterwards, cash on delivery.',
  $html$
<h2>Dandruff is not dry scalp</h2>
<p>This is why so many people treat it for years without getting anywhere. Dandruff is usually driven by malassezia, a yeast that lives on everyone's scalp and that some people react to. It produces greasy, yellowish flakes and an itch. Genuine dry scalp gives small white dust-like flakes and tight skin, and it responds to moisture. Treating dandruff with a moisturising shampoo does nothing, and treating a dry scalp with a medicated one makes it worse.</p>
<h3>The everyday option</h3>
<p>CeraVe Anti-Dandruff Hydrating Shampoo ([[price:cerave-anti-dandruff-hydrating-shampoo]]) uses pyrithione zinc against the yeast, with ceramides and hyaluronic acid so the scalp does not end up raw. This is the one to use if you want something you can keep using rather than a short course.</p>
<h3>When that is not enough</h3>
<p>La Roche-Posay Kerium DS ([[price:la-roche-posay-kerium-ds-anti-dandruff-shampoo]]) pairs pyrithione zinc with salicylic acid, so it treats the yeast and lifts the scale already stuck to the scalp. Use it twice a week for two to four weeks, then stop and maintain with something gentler. It is a course, not a permanent shampoo, and staying on a strong medicated wash indefinitely tends to irritate.</p>
<h3>The step people skip</h3>
<p>Leave it on. A medicated shampoo needs two to three minutes of contact with the scalp to do anything, and most people rinse it straight out. That single change fixes more cases than switching brands does.</p>
<h3>Conditioner during a course</h3>
<p>The CeraVe Anti-Dandruff Conditioner ([[price:cerave-anti-dandruff-hydrating-conditioner]]) carries the same active, which matters because a rich ordinary conditioner applied to the scalp can undo the wash you just did. If you use a different conditioner, keep it on the lengths.</p>
<h3>When to see a doctor instead</h3>
<p>If the flaking is greasy and yellow and spreads to your eyebrows, the sides of your nose or your chest, that is seborrhoeic dermatitis rather than ordinary dandruff, and it is worth a dermatologist. Same if the scalp is painful, bleeding, or losing hair in patches.</p>
$html$,
  $faq$[{"q":"How long before dandruff clears?","a":"Two to four weeks of consistent use for most people. If nothing has changed after a month of using it properly, with two to three minutes of contact time, the problem is probably not ordinary dandruff."},
    {"q":"Will dandruff come back if I stop?","a":"Usually, yes. The yeast behind it lives on everyone's scalp, so treatment controls it rather than removing it. Most people settle into a maintenance wash once or twice a week."},
    {"q":"Can I use an anti-dandruff shampoo every day?","a":"The gentle pyrithione zinc ones, yes. The stronger course shampoos, no, they are meant for a few weeks and then a step down to maintenance."},
    {"q":"Does oiling the scalp help dandruff?","a":"It usually makes it worse. Malassezia feeds on oil, so adding oil to a flaking scalp and leaving it overnight gives it more of what it wants. Oil the lengths instead if you want to."}]$faq$::jsonb),

( 'hair-growth',
  'Hair Growth & Hair Fall',
  'Minoxidil, a multi-peptide scalp serum, rosemary and castor oils, and the biotin shampoo and conditioner. Honest about which of these has evidence behind it and which is worth a try alongside.',
  'smart',
  '{"match":"any","conditions":[{"field":"tag","op":"in","value":["hair-growth"]}]}'::jsonb,
  'published', 122,
  'Hair Fall & Hair Growth Treatments in Pakistan',
  'Hair fall treatments in Pakistan: Minoxin 5% minoxidil, The Ordinary multi-peptide density serum, rosemary and castor oil, biotin shampoo. What the evidence says, live prices, cash on delivery.',
  $html$
<h2>Start with what has evidence</h2>
<p>Hair fall is the category with the widest gap between what is marketed and what works, so it is worth saying plainly where each of these sits.</p>
<h3>Minoxidil</h3>
<p>Minoxin Plus 5% ([[price:minoxidil]]) is the only licensed medicine on this page and the one with the strongest evidence for regrowth in pattern hair loss. Two things to know before starting. It takes three to six months to judge, and hair often sheds more in the first few weeks before it improves, which is when most people quit. And it works for as long as you use it, so stopping returns you to where you started.</p>
<h3>The non-medicated route</h3>
<p>The Ordinary Multi-Peptide Serum for Hair Density ([[price:the-ordinary-multi-peptide-hair-density-serum]]) stacks peptide and caffeine complexes in a leave-on scalp serum. The evidence behind it is real but considerably weaker than minoxidil's. It is the option for people who would rather not use a drug, and some people use both, one in the morning and one at night.</p>
<h3>Oils</h3>
<p>Rosemary oil ([[price:rosemary-oil]]) has one reasonable trial behind it comparing it to minoxidil over six months, which is more than most oils can claim, though it is a single small study. Castor oil ([[price:castor-oil]]) has effectively none for growth, and the thickness people notice is the oil coating the strand. Saeed Ghani Hair Growth Water ([[price:hair-growth-oil]]) is the traditional herbal option at the lowest price on this page. All of these go on the scalp, not the lengths, and all need months rather than weeks.</p>
<h3>Shampoo that helps rather than treats</h3>
<p>OGX Thick &amp; Full + Biotin &amp; Collagen ([[price:ogx-biotin-collagen-shampoo]] and [[price:ogx-biotin-collagen-conditioner]]) makes hair look and feel thicker by coating the strand. That is a cosmetic effect and a useful one while a real treatment is working, and it is not regrowth.</p>
<h3>Before spending anything</h3>
<p>Sudden hair fall across the whole scalp, rather than thinning at the temples or crown, is usually telling you something: iron deficiency, thyroid, a recent illness, pregnancy, crash dieting or severe stress. A blood test costs less than three months of any product on this page and it is the first thing to do.</p>
$html$,
  $faq$[{"q":"How long until I see results?","a":"Three months at the absolute minimum, six to judge properly. Hair grows about a centimetre a month, so nothing meaningful can show sooner, and any product promising faster is selling to your impatience."},
    {"q":"Does biotin stop hair fall?","a":"Only if you are deficient in it, which is rare. Biotin supplements do nothing for hair in people with normal levels, and they can distort thyroid blood tests, so mention them before any test."},
    {"q":"Is the shedding at the start of minoxidil normal?","a":"Yes. It pushes resting hairs out so new ones can grow, usually in the first two to eight weeks. It settles, and quitting during it is the most common reason people conclude minoxidil did not work."},
    {"q":"Can women use minoxidil?","a":"Yes, it is widely used for female pattern hair loss, though the recommended strength can differ. Worth asking a doctor first, especially if you are pregnant or breastfeeding."}]$faq$::jsonb)

on conflict (slug) do nothing;

-- ── 4. The hair-care collection still described the old five-product shelf ──
update public.collections
set description = 'The full hair shelf: anti-dandruff shampoos from CeraVe and La Roche-Posay, OGX argan oil and biotin ranges, Olaplex bond repair, a multi-peptide density serum, minoxidil and the scalp oils.',
    seo_title = 'Hair Care in Pakistan: Shampoo, Serums & Hair Fall',
    seo_description = 'Imported hair care in Pakistan from CeraVe, La Roche-Posay, OGX, Olaplex and The Ordinary. Anti-dandruff shampoos, conditioners, bond repair, minoxidil and scalp oils, cash on delivery.',
    updated_at = now()
where slug = 'hair-care';

-- ── 5. Subcategories, so the category page can be filtered ─────────────────
update public.products set subcategory = 'Hair Oil', updated_at = now()
where slug in ('rosemary-oil', 'castor-oil');

update public.products set subcategory = 'Hair Treatment', updated_at = now()
where slug in ('minoxidil', 'hair-growth-oil');

update public.products set subcategory = 'Hair Mask', updated_at = now()
where slug = 'argan-oil-of-morocco-hair-mask';

commit;
