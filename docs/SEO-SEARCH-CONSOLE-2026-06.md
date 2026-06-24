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

## Finding 1 — Legacy WordPress URLs still surface in the index, but the cutover and redirects are already correct (live-verified)

GSC shows the same content under two URL shapes — old *flat* WordPress paths and
the new `/product`,`/blog` paths — and in several cases the flat URL still
out-impresses the new one:

| URL in GSC | Clicks | Impr | Pos |
|---|---:|---:|---:|
| `yellowpink.pk/argivital-sachet-...-pakistan/` (flat) | **5** | 64 | 7.4 |
| `www.yellowpink.pk/product/semofer` (new) | 4 | 75 | 7.1 |
| `yellowpink.pk/top-10-pcos-supplements-pakistan/` (flat) | 2 | 95 | 19.3 |
| `yellowpink.pk/m-sol-vs-myofolic-...-2026/` (flat) | 1 | **134** | 8.8 |
| `www.yellowpink.pk/blog/m-sol-vs-myofolic-...-2026` (new) | 0 | 40 | 8.2 |

**I probed this live (2026-06-24) and the migration is actually in good shape:**

- `yellowpink.pk` → **308** → `www.yellowpink.pk` (Vercel/Next.js everywhere; no WordPress is serving).
- The legacy flat URLs **already 301 to the correct new page** and resolve `200`,
  e.g. `…/argivital-sachet-…-pakistan/` → `/blog/argivital-sachet-…`,
  `…/top-10-pcos-supplements-pakistan/` → `/blog/top-10-pcos-supplements-pakistan`,
  `…/m-sol-vs-myofolic-…/` → `/blog/m-sol-vs-myofolic-…`.

So this is **not** two live sites cannibalizing each other (an earlier draft of
this doc overstated it). It's normal post-migration **index lag**: Google still
lists the old flat URLs it knew, but every one redirects to the new canonical, so
the index will consolidate on its own. No code change is required.

**Minor cleanup worth doing (low priority):**
1. The flat apex URLs take **two hops** (apex→www, then flat→`/blog`). Collapsing
   to a single 301 (handle the path rewrite on the apex host directly) is tidier
   and passes equity marginally better, but isn't urgent.
2. Speed consolidation by submitting the updated sitemap + using the URL
   Inspection tool on the new `/product`,`/blog` URLs so Google recrawls and drops
   the legacy duplicates faster.

> Net: the dual-URL appearance is transitional and self-healing. The real levers
> are Findings 2 and 3 below, not a redirect rebuild.

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

1. **CTR pass on the top branded SKUs (Finding 3).** Fastest win, no ranking
   change needed. ✅ *Done:* (a) the product title template now appends a
   localized "Price in Pakistan" intent cue for short branded SKUs
   (`src/app/product/[slug]/page.tsx`); (b) hand-written `seo_title` +
   `seo_description` overrides applied to the **16 highest-impression / weakest-CTR
   SKUs** (DB, 2026-06-24) — each leads with the searched term and adds an intent
   cue (`uses` / `price in pakistan`), price and COD: semofer, m-sol-sachet,
   ferosim, greelac, meth-d, calin-g, repro-m, argivital-sachet, marixtizer,
   multiflux, s-lyte, x-fit, syror, simfolic, fol-chew, simrid. (Several had
   placeholder metas — e.g. Syror's description was "Composition Soy Isoflavones
   (USP) 50 mg"; M-Sol's title was a bare "M-Sol Sachet".) Live via ISR (~5 min).
   **Tier 2 (2026-06-24):** 13 more SKUs rewritten — morr, vit-kd, puratin,
   citowit, finkuff, fybosim, artibro, cranblue, eletcid, stevoice, calosent,
   flex-4, cee (several were bare placeholders: "MORR", "Vit KD", "Puratin";
   others were >60-char titles that truncated). **29 SKUs total now have
   hand-tuned meta.** Already-strong rows (calco-fit, gluthic, trimo-m,
   simdac-drops, f-lium-drops, leukaz, pelargonium, ultrapin) left as-is.
   *Next:* watch GSC CTR on these over 2–3 weeks; extend to remaining catalog if it pays off.
2. **Pivot content + the backlink data asset to PCOS/fertility/men's health
   (Finding 2).** ✅ *Started:* PCOS data-asset draft in
   `docs/content-drafts/pcos-in-pakistan.md`.
3. **Backlinks campaign** (`docs/SEO-BACKLINKS.md`) — the long-term authority play.
4. **Index consolidation (Finding 1).** Self-healing; just submit the sitemap and
   inspect the new URLs to speed it up. Optional: collapse the legacy two-hop
   redirect to one.
5. Skincare/makeup: keep publishing, but treat as a 2–3 quarter horizon.

> **Update 2026-06-24:** Semrush Site Audit pulled (Health 80/100) — see
> `SEO-SITE-AUDIT-2026-06.md`. Content pass done: 21 broken internal links in the
> fertility/PCOS/men's-health blog cluster fixed and verified. Backlink round 2 +
> keyword-gap run (both low-yield — competitors are branded/cosmetics).
