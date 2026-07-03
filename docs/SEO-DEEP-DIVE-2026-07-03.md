# SEO Deep-Dive — 3 July 2026

Semrush research pass (Pakistan database) beyond the weekly site-health crawl:
organic rankings, keyword-gap mining, competitor and backlink analysis — plus
the content fixes implemented the same day. Site health itself is 90+ and
technically clean (robots.txt correct, sitemap live, legacy WordPress URLs all
301 to their new homes); this document is about *growth*, not hygiene.

## 1. Where we stand

| Metric (Semrush, pk database) | yellowpink.pk | nutrifactor.com.pk |
|---|---|---|
| Organic keywords in top 100 | **26** | 8,787 |
| Estimated organic traffic /mo | **~0** | ~209,000 |
| Authority Score | **2** | 39 |
| Referring domains | **2** | 4,644 |

Every keyword we rank for sits on **page 3 or deeper** (best: #30 for "pcos
medicine in pakistan", #33 for "myofolic sachet for conceiving"). Nothing is in
striking distance of page 1 yet, and at Authority Score 2 nothing will be for
competitive terms — **domain authority is the binding constraint**, not
on-page quality.

What Nutrifactor's traffic teaches us: ~35% is their brand name (built off-line
and with ads), and the rest comes from **ingredient/collection pages ranking #1
for generic terms** ("magnesium glycinate" 40k/mo, "biotin tablets" 12k/mo,
"glutathione" 18k/mo) plus "X price in pakistan" transactional queries. Their
one high-value press link: dawn.com (Authority 74).

## 2. Strategy that fits Authority Score 2

Chase keywords with **difficulty (KD) under ~20** where content quality alone
can win, especially local-language and Urdu-hybrid queries the big stores
ignore. Compound that with steady link-building until harder terms open up.

### Keyword opportunities found (all winnable, KD ≤ ~25)

| Cluster | Keyword | Vol/mo | KD | Our asset |
|---|---|---|---|---|
| Pigmentation | best cream for pigmentation in pakistan | 720 | 13 | NEW pillar post |
| | melasma cream in pakistan | 480 | 6 | pillar + product |
| | best cream for melasma in pakistan | 390 | 6 | pillar |
| | pigmentation cream in pakistan | 390 | 9 | pillar |
| | best medicated cream for dark spots in pakistan | 210 | 4 | pillar |
| | anti melasma cream | 260 | 12 | product page |
| | melasma cream price in pakistan | 170 | 6 | pillar (price table) |
| Likoria | likoria symptoms | 1,300 | 16 | white-discharge post |
| | likoria causes | 1,300 | 23 | " |
| | what is likoria | 1,300 | 27 | " |
| | likoria in english | 1,000 | 20 | " |
| | likoria causes in unmarried girl | 1,000 | 25 | " |
| | leukorrhea treatment | 1,600 | 31 | " (FAQ) |
| Prenatal | prenatal vitamins in pakistan | 260 | 10 | prenatal guide |
| | prenate tablet (+ uses) | 880/590 | 11/15 | brands section |
| | pregnacare conception / max | 1,300/320 | 17/16 | brands section |
| | pregna essential tablet | 260 | 7 | brands section |
| PCOS | what are the first signs of pcos | 1,300 | 31 | PCOS post (new H2) |
| | pcos test | 880 | 36 | PCOS post (new H2) |
| K-beauty | korean skin care products | 590 | 18 | /k-beauty (future copy) |

The likoria find is the emblematic one: our medically solid post used only the
English term "leukorrhea" — the word Pakistanis actually search, **likoria**,
appeared nowhere on the site.

## 3. Implemented today (live in production)

1. **White-discharge post → likoria expansion**: retitled to "White Discharge
   (Likoria): …", new sections "Likoria in English", "Likoria causes and
   symptoms" (including a respectful, myth-busting answer to the huge
   "unmarried girls" query), and two likoria FAQs. Targets ~7 keywords,
   ~7,500 combined monthly searches, KD 16–31.
2. **New pillar post** `/blog/best-pigmentation-melasma-cream-pakistan`:
   "Best Pigmentation & Melasma Creams in Pakistan (2026)" — ingredient guide,
   price table (answers "price in pakistan" queries), jhaiyan/chaiyan local
   terms, bazaar-cream safety warning, sunscreen section, FAQs. Links 10
   in-stock products.
3. **PCOS post**: added "What are the first signs of PCOS?" and "How is PCOS
   tested in Pakistan?" sections (KD 31–36 terms, 2,100 combined volume).
4. **Prenatal guide**: added "Popular Prenatal Brands and Prices in Pakistan"
   (Pregnacare, Prenate, Pregna Essential + our FOL Chew / pregnancy bundle),
   ToC updated.
5. **Anti-melasma product**: seo_title now leads with the transactional term —
   "Melasma Cream in Pakistan: Kojic + Glutathione" — plus a price-bearing
   meta description. (Its "melasma cream" ranking, 1,600/mo vol, was #55.)

Expect movement over 2–6 weeks as Google recrawls; the sitemap picks the new
post up automatically.

## 4. Backlink plan (the ceiling-raiser)

With 2 referring domains, every real link moves the needle. Realistic PK
sources, in priority order:

1. **Press / digital media** — dawn.com (Images section), tribune.com.pk
   (Life & Style), propakistani.pk, brandsynario.com, mangobaaz.com. Angle:
   founder story ("pharmacist-curated online pharmacy+beauty store"), seasonal
   skincare/health explainers offered as expert commentary, or data pieces
   ("what Pakistan searched for in skincare in 2026").
2. **Health/beauty bloggers & YouTubers** — product-review seeding (K-beauty
   sells this way already); ask for a link with the review.
3. **Brand/supplier pages** — NB Sons and other vendors' "where to buy" pages;
   the manufacturers of Argivital/Femeez/etc. listing Yellow Pink as a
   stockist. Easiest wins available — these are existing business partners.
4. **Directories that matter** — Google Business Profile (also feeds local
   pack), findpk / Pakistan business directories, daraz-adjacent price
   aggregators.
5. **Medical Review Board flywheel** — each doctor who joins has a clinic
   site/profile that can link to their Yellow Pink reviewer profile.

Outreach itself needs the owner (relationships, emails from the brand
address); happy to draft the pitch emails on request.

## 5. Watchlist / next passes

- **Weekly**: Semrush position tracking on the cluster keywords above.
- **Content cadence**: one KD<20 cluster post per week beats anything else at
  this authority level. Next candidates: "korean skin care products in
  pakistan" (KD 18) for /k-beauty, "likoria ka ilaj" variants, per-brand
  buying guides ("CeraVe price in Pakistan" family).
- **Golden Pearl + Hello Hair draft catalogues** (~400 products) remain the
  biggest indexable-surface lever once published with real content.
- Re-check GSC indexing coverage mid-July; CSP goes enforcing ~9 July.
