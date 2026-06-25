# Catalogue gaps — demand without a SKU

**Last updated:** 2026-06-21 · Source: Semrush PK database (search volumes), live
catalogue cross-check.

These are categories where Pakistani shoppers are actively searching but Yellow
Pink has **no product to rank or sell**. Adding a SKU is a sourcing/buying
decision (real product, price, stock, photography) — this brief quantifies the
opportunity so that decision is informed. Volumes are monthly PK searches;
competition is the Semrush paid-difficulty index (0–1, lower = easier).

> **📄 Full sheet: [`docs/catalogue-gaps.csv`](./catalogue-gaps.csv)** — all ~35
> gaps across supplements + beauty/hair, each with PK demand, competition,
> coverage status, a **suggested product**, a **locally-available source**, the
> **price in PKR** and a URL. Open it in Excel / Google Sheets. The sections
> below are the narrative for the highest-value gaps.

**Already actioned this session:** launch blog posts published for
collagen, omega-3 and biotin (capturing the informational intent now), and
hidden **draft product scaffolds** created for those three
(`collagen-peptides-powder`, `omega-3-fish-oil`, `biotin-10000-mcg`) with
keyword-ready meta — set a price/stock/image and publish once sourced.

## Local sourcing at a glance
From the price research (see the CSV for per-item detail):

- **Supplements → Nutrifactor** (Pakistani brand, also on dvago.pk / dawaai.pk /
  healthwire.pk) is the easiest, cheapest route and covers almost every gap
  (B12, melatonin, ACV, omega-3, biotin, zinc, ginseng, ginkgo, vitamin E,
  CoQ10, B-complex, creatine, whey) at ~PKR 850–6,500. Imported options
  (Natural Factors, Nature's Bounty, NeoCell, Seven Seas) exist where a local
  equivalent is weak (selenium, probiotics, cod liver oil, sublingual B12).
- **Beauty/hair naturals → Conatural, Saeed Ghani, Hemani** cover rosemary oil,
  castor oil, HA serum, lip balm, hair-growth oil cheaply (~PKR 350–1,500).
- **Colour cosmetics → Rivaj UK / Saeed Ghani** (kajal, eyeliner, mascara, lip
  liner, setting spray) at ~PKR 100–700.
- **Pharmacy → minoxidil** (Minoxin Plus etc. on healthwire.pk / dvago.pk).

> Prices marked "unconfirmed" in the CSV came from search snippets because some
> retailers (Naheed, Daraz, dawaai) render prices via JavaScript — verify those
> on-page before committing stock.

## Priority gaps

### 1. Oral collagen — biggest opportunity
| Keyword | Vol/mo | Comp |
|---|---|---|
| collagen | 14,800 | 0.20 |
| collagen powder | 9,900 | 0.27 |
| collagen supplement | 3,600 | 0.30 |
| marine collagen | 1,000 | 0.52 |

- **Demand:** ~29k/mo across the cluster — the single largest gap.
- **What we have:** only **Medicube Collagen Jelly Cream** (topical moisturiser) —
  it does **not** serve "collagen powder/supplement" intent.
- **Suggested SKU:** an ingestible collagen — hydrolysed marine or bovine
  collagen peptides, powder (sachets/tub) and/or capsules. A "beauty-from-within"
  angle ties into the existing skincare audience.
- **Fits:** Women's Health / Wellness; pairs with the existing
  `beauty-from-within-glow` combo and The Skincare Edit.

### 2. Omega-3 / fish oil
| Keyword | Vol/mo | Comp |
|---|---|---|
| omega 3 | 8,100 | 0.12 |
| omega 3 fish oil | 5,400 | 0.19 |
| fish oil | 2,400 | 0.13 |
| omega 3 price in pakistan | 1,300 | 0.18 |

- **Demand:** ~17k/mo, **low competition** — easy to rank once stocked.
- **What we have:** nothing (no EPA/DHA SKU).
- **Suggested SKU:** standardised fish-oil softgels (e.g. 1000mg with stated
  EPA/DHA); an algal/vegetarian omega-3 is a useful second variant.
- **Fits:** Heart Health / Wellness; cross-sells with Vit-KD and the bone/heart
  stacks.

### 3. Biotin
| Keyword | Vol/mo | Comp |
|---|---|---|
| biotin | 8,100 | 0.24 |
| biotin for hair | 1,000 | 0.30 |
| biotin price in pakistan | 320 | 0.23 |

- **Demand:** ~9.4k/mo. Strong hair/skin/nails intent.
- **What we have:** only **Multiflux** (broad multivitamin) — not a biotin SKU.
- **Suggested SKU:** standalone biotin (e.g. 5,000–10,000mcg) tablets/gummies;
  optionally a hair-skin-nails blend (biotin + zinc + collagen) that also feeds
  gap #1.
- **Fits:** Hair Care / Wellness; cross-sells with the Argan hair mask and the
  skincare range.

## Already covered — capture, don't source

- **Ivy-leaf cough syrup** (`ivy leaf cough syrup`, 880/mo, comp **0.01**) was
  previously listed as a gap but is **stocked**: **Simrid Ivy Leaf Extract Syrup**
  and **Pelargonium Ivy Leaf**. Both had their `seo_title`/`seo_description`
  re-pointed at this query (migration `…_165`), and the supporting blog posts
  (`simrid-respiratory-health-supplement-pakistan`,
  `finkuff-herbal-cough-syrup-pakistan`) already exist. No sourcing needed.

## How to add a SKU (when sourced)
Admin → Products → New: set name, brand, price, stock, category, a real product
image, and a structured description. Leave `seo_title`/`seo_description` blank to
inherit the keyword-aware auto-template, or set them to lead with the head term +
"in Pakistan". The product then flows into the sitemap, feeds, and JSON-LD
automatically. Consider a launch blog post (mirroring the content-gap articles)
that internally links to the new PDP.

## Competitor reference (PK)
Who currently ranks for these terms: see the competitor set in
`docs/SEO-KEYWORDS.md` (chemist.pk, dvago.pk, healthwire.pk and the supplement
specialists). Worth a quick price check against them before setting a price.
