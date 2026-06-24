# Search Console Findings — Yellow Pink (2026-06, first ~5 weeks of data)

> Source: Google Search Console export, Web search, last 3 months (real data
> begins 2026-05-17 once indexing started). Pairs with `docs/SEO-KEYWORDS.md`
> (planned keywords) and `docs/SEO-BACKLINKS.md` (off-page). This is the first
> look at what the site is *actually* doing in Google, and it reorders the plan.

## Snapshot

- **29 clicks / 1,197 impressions**, avg position **10.6**, CTR **2.4%** — over ~5 weeks.
- **Pakistan is ~100% of it** (29/29 clicks, 1,197 PK impressions). Everything else is single-digit impressions.
- **Mobile dominates:** 1,057 of 1,313 impressions (~88%); 26 of 29 clicks. Desktop ranks far worse (pos 26 vs 7.4 on mobile).
- Only Search Appearance with data: **Product snippets** (rich results are firing — good).

The headline: the site is **indexed and ranking** (avg pos ~7 on mobile), but
clicks are tiny because of three fixable problems below.

## Finding 1 — CRITICAL: the old WordPress site and the new Next.js site are both live and cannibalizing each other

The app has **no root-level catch-all route** (`src/app/` has `product/[slug]`,
`blog/[slug]`, `page/[slug]` — but no `/[slug]`). Yet GSC shows *flat* URLs
ranking and taking clicks — these can only be served by the **legacy WordPress
storefront** still answering on the apex `yellowpink.pk`:

| URL in GSC | Served by | Clicks | Impr | Pos |
|---|---|---:|---:|---:|
| `yellowpink.pk/argivital-sachet-...-pakistan/` | **WordPress** (flat) | **5** | 64 | 7.4 |
| `www.yellowpink.pk/product/semofer` | Next.js | 4 | 75 | 7.1 |
| `yellowpink.pk/top-10-pcos-supplements-pakistan/` | **WordPress** (flat) | 2 | 95 | 19.3 |
| `yellowpink.pk/m-sol-vs-myofolic-...-2026/` | **WordPress** (flat) | 1 | **134** | 8.8 |
| `www.yellowpink.pk/blog/m-sol-vs-myofolic-...-2026` | Next.js | 0 | 40 | 8.2 |

The **same content is indexed twice** — the WordPress flat URL and the new
`/blog` or `/product` URL — and in several cases the *old WP page is winning*
(the m-sol article: 134 impressions on WP vs 40 on Next; argivital's flat WP URL
is the single best-clicking page on the site). Google is splitting ranking
signals and link equity across two competing copies. The homepage alone appears
as **three** URLs: `http://yellowpink.pk/`, `https://yellowpink.pk/`, and
`https://www.yellowpink.pk/`.

`next.config.ts` already has an apex→www 308 and a few blog-consolidation 301s,
but those only fire for requests the **Next app** serves. Because the flat apex
URLs are still serving (and clicking), the apex is evidently **still pointed at
WordPress**, so the redirect never runs for them.

**Impact:** this is very likely the biggest single drag on performance and on the
Authority Score 2 problem — backlinks and age are spread across two domains/URL
sets that don't pass equity to each other.

**Fix (needs an ops decision — see question at the end):**
1. Point the apex `yellowpink.pk` at the Next.js app (or 301 the whole apex to `www`).
2. Add **301s from every legacy WordPress URL → its new equivalent** (flat
   `/argivital-sachet-.../` → `/product/argivital-sachet`, flat
   `/top-10-pcos-supplements-pakistan/` → `/blog/top-10-pcos-supplements-pakistan`,
   etc.). This consolidates the older WP pages' equity onto the new ones — and
   since the WP pages currently out-impress the new ones, that should be a real lift.
3. Confirm in GSC that the WP flat URLs drop out and the `/product`,`/blog` URLs absorb the impressions.

> I can build the redirect map in `next.config.ts` once we confirm the apex is
> (or will be) served by the Next app and I have the legacy URL list (the WP
> sitemap, or I can derive most from the product/post slugs). I did **not** do
> it blind because the right form depends on the hosting/DNS cutover state.

## Finding 2 — Real demand is wellness / PCOS / fertility / men's health, NOT skincare & makeup

`docs/SEO-KEYWORDS.md` was built around skincare/makeup head terms (niacinamide,
retinol, CeraVe…). The actual impressions and **every single click** come from
the **supplement/pharma side** — branded NB-Sons-style product names and a
fertility/PCOS/prenatal cluster:

- **Branded product queries:** argivital, repro m / repro-m, semofer, m sol
  sachet, meth d, ferosim, calin g, greelac, myofolic, multiflux, s-lyte, marixtizer…
- **Category/informational, all wellness:** "pcos supplement (in pakistan)",
  "best tablet for pcos in pakistan", "top 10 male fertility supplements in
  pakistan", "prenatal/pregnancy vitamins", "moringa supplement", "fertility supplements".
- **Skincare/makeup is nearly invisible:** "cerave acne control cleanser" sits at
  pos 79–84; makeup terms (sheglam, pixi, rhode lip tints) get 1 impression each
  at poor positions.

**Implication:** lean the content engine and the link-building **data asset into
PCOS / fertility / women's & men's reproductive health**, where the site already
has genuine ranking traction and topical authority is forming. Skincare/makeup is
a longer horizon and shouldn't lead the next quarter.

> Action: I've noted in `docs/SEO-BACKLINKS.md` §5 that the linkable data asset
> should be PCOS/fertility-led (e.g. "PCOS in Pakistan: prevalence & what the
> evidence says"), which both matches demand *and* the strongest pages.

## Finding 3 — Ranking 5–10 but ~0% CTR on branded product queries (fast win)

Many branded queries already rank on page 1 yet get **zero clicks**:

| Query | Impr | Pos | Clicks |
|---|---:|---:|---:|
| meth d tab | 54 | 10.2 | 0 |
| m sol sachet | 50 | 8.0 | 0 |
| ferosim | 36 | 7.4 | 0 |
| semofer | 27 | 5.5 | 0 |
| calin g tablet uses | 19 | 9.2 | 0 |
| greelac | 17 | 5.6 | 0 |

That's ~200 impressions at positions 5–10 converting at 0%, where a normal CTR
for those positions is ~3–6%. Likely causes: unfamiliar new-store brand in the
SERP, and title/meta that don't signal "buy / price / in stock in Pakistan".

**Fix (in-repo, low risk, high ROI — faster than backlinks):** tune product
`<title>`/meta-description for these head SKUs to include intent signals — price,
"Buy online in Pakistan", "✓ In stock", delivery. Even lifting these to a normal
CTR roughly **doubles total clicks with no ranking change**. The homepage already
shows this works: brand searches there convert at **30% CTR** (9 clicks/30 impr).

## Reprioritized action list

1. **Resolve the WP↔Next dual-indexing (Finding 1).** Highest impact; needs the ops decision below.
2. **CTR pass on the top ~15 ranking SKUs (Finding 3).** Quick in-repo win; do regardless of #1.
3. **Pivot content + the backlink data asset to PCOS/fertility/men's health (Finding 2).**
4. **Backlinks campaign** (`docs/SEO-BACKLINKS.md`) — still the authority play, but it
   can't fully pay off until #1 stops splitting equity across two sites.
5. Skincare/makeup: keep publishing, but treat as a 2–3 quarter horizon.

## Open question for the owner

Is the apex `yellowpink.pk` still served by the **old WordPress** site, and is the
plan to fully cut over to the Next.js app on `www`? The redirect/consolidation fix
(Finding 1) depends on that answer. If yes, I'll build the legacy→new 301 map in
`next.config.ts` from the WP URL list.
