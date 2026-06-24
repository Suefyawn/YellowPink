# Semrush Site Audit + Ops Round 2 — Yellow Pink (2026-06-24)

> Source: Semrush Site Audit (project 29781271, snapshot 2026-06), plus
> backlink round-2 mining and a competitor keyword-gap. Companion to
> `SEO-KEYWORDS.md`, `SEO-BACKLINKS.md`, `SEO-SEARCH-CONSOLE-2026-06.md`.

## 1. Site Audit health — 80/100 (solid)

582 pages crawled. Thematic scores: **HTTPS 100, Internal SEO 100, Markups 100,
Performance 97, Crawlability 76, Linking 74.** Structured data is all valid
(2,014 items, 0 invalid — Product, Article, Organization, Breadcrumb, FAQ,
Merchant listing, etc.). The two soft spots are Crawlability and Linking.

### Issues, decoded and triaged

| Issue | Count | Verdict |
|---|---:|---|
| **Broken internal links (id 8)** | 21 | ✅ **Fixed this session** (see §2) |
| 4xx pages (id 2) | 17 | Mostly the targets of those broken links; re-crawl should clear |
| Temporary redirects (id 109) | 619 | **Not a ranking problem** — it's the site-wide header "My Account" link → `/account` → 307 → `/login`. A 307 is *correct* for an auth gate (you must NOT 301 it). Counted once per page that links to it. Optional: `rel="nofollow"` the account/cart/login links to save crawl budget. |
| Multiple canonical URLs (id 39) | 23 | Worth a look — pages emitting two canonical tags. Likely a layout+page double-set on a specific template. |
| Redirect chains/loops (id 33) | 11 | The apex→www then →/blog two-hop on legacy links. Low priority. |
| Pages with one internal link (id 213) | 92 | The "Linking 74" driver — deeper internal linking (incl. §2) helps. |
| Low text/HTML ratio (id 112) | 274 | Mostly catalog/listing pages; expected for a storefront. |
| Duplicate titles/meta (id 6/15) | 7 / 6 | Minor; the per-SKU meta pass already reduced these. |

> The headline number that looked alarming — "619 temporary redirects, growing" —
> is a false alarm once you see the URLs: it's one correct auth redirect counted
> per page. Not worth a code change beyond optionally nofollow-ing auth links.

## 2. Content pass — fixed 21 broken internal links (verified)

All 21 broken internal links lived inside the **fertility / men's-health / PCOS
blog cluster** — the exact high-demand vertical from Search Console. The authors
had linked to flat URLs that never existed (e.g. `/moringa-supplement-pakistan`,
`/m-sol-vs-myofolic-pcos-pakistan`, `/meth-d-vitamin-d3-b12-pakistan`). Each was
remapped to its real existing page and fixed in-place in the post body (DB),
verified to **0 remaining**:

| Affected post | Broken links fixed |
|---|---:|
| best-fertility-supplements-karachi-2026 | 5 |
| buy-m-sol-sachet-karachi | 4 |
| buy-x-fit-lahore-male-supplements | 4 |
| l-arginine-benefits-men-pakistan-guide | 4 |
| coq10-benefits-fertility-pakistan-guide | 2 |
| simrid-respiratory-health-supplement-pakistan | 2 |

Mapping examples: `/moringa-supplement-pakistan` → `/blog/morr-moringa-supplement-pakistan`;
`/m-sol-vs-myofolic-pcos-pakistan` → `/blog/m-sol-vs-myofolic-best-myofolic-alternative-pakistan-2026`;
`/meth-d-vitamin-d3-b12-pakistan` → `/product/meth-d`;
`/vitamin-c-supplement-pakistan` → `/blog/cee-vitamin-c-500mg-supplement-pakistan`.

This turns 21 dead links into live internal links, lifting the Linking score and
passing equity through the priority content cluster. Live via ISR (~5 min).

## 3. Backlink round 2 — conclusion: Golden Pearl is mined out

Pulled Golden Pearl's referring domains beyond the top band (offset 25–75) and
its anchor profile. The deeper band is **global noise** (finalscout.com,
selling.com, US SEO-tool junk) — no PK health/editorial targets. Anchor profile
is mostly brand + a few "best body lotion / whitening soap / best moisturizer"
roundup anchors (confirming competitors earn links via **"best X" roundup
content**, plus a Urdu coupon anchor "ڈیل دیکھیں →").

**Takeaway:** the worthwhile PK targets were all in the top band already captured
in `SEO-BACKLINKS.md` (reviewit.pk, brandsynario.com, jamals.com). No new
high-value prospects from round 2. The replicable tactic is publishing **"best X
in Pakistan" roundups** (which the site already has for PCOS/fertility) and
earning links to them.

## 4. Keyword-gap — competitors are branded; wellness has no good gap target

`domain_organic` on goldenpearl.com.pk (PK): **~97% of its organic traffic is
branded** ("golden pearl …"). The only transferable non-branded opportunities are
a few low-difficulty **skincare commercial terms** the storefront's catalogue can
target:

| Keyword | Vol (PK) | KD | Note |
|---|---:|---:|---|
| vitamin c serum price in pakistan | 4,400 | 8 | We carry Vitamin C serum/cream — strong, low-KD target |
| skin polishing | 3,600 | 12 | — |
| foaming face wash | 590 | 6 | Very low KD |
| skin polish price in pakistan | 1,000 | 10 | — |
| facial kit | 2,900 | 13 | — |

The **wellness/PCOS/fertility vertical** (where actual traction is) has **no
suitable Semrush competitor to gap against** — those competitors are cosmetics
brands. That opportunity set is better defined by GSC + `SEO-KEYWORDS.md` than by
a domain gap.

## 5. Remaining items needing the owner (UI/access)

- **Enable Position Tracking** on the Semrush project (currently only Site Audit
  is active) + add the `SEO-KEYWORDS.md` §4 keyword set — then rank movement is
  trackable session-to-session.
- **GSC:** submit sitemap + URL-inspect the new `/product`,`/blog` URLs to speed
  index consolidation.
- **Outreach:** send the `SEO-BACKLINKS.md` emails / place the directory + stockist listings.
- **Optional code polish:** `rel="nofollow"` on header account/cart/login links
  (trims the 619 auth-redirect crawl noise); investigate the 23 multiple-canonical pages.
