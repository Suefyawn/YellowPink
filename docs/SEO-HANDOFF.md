# SEO Handoff — for the next session (Semrush MCP available)

> Written 2026-06-21 at the end of a long content/cleanup session. The **Semrush
> MCP** will be available next session; this session deliberately did **not**
> write keyword-optimised meta, so that work can be data-driven. Everything
> below is the runway so next session is pure SEO execution.

## 0. The site at a glance
- **Live:** https://www.yellowpink.pk — Next.js (App Router) + Supabase, Vercel.
- **Market:** Pakistan. PKR, **zone-based delivery** (free over PKR 5,000 in Punjab, higher thresholds for other regions — exact figure shown at checkout), COD nationwide.
- **Catalogue:** ~142 published products. Three pillars: **Makeup**, **Skincare**,
  **Wellness (supplements)**. Plus **Bundles**.
- **Brands:** real imported brands (PIXI, CeraVe, Beauty of Joseon, NARS, …) **and
  NB Sons** — the in-house supplement brand (56 products; the "Nazirs Group"
  vendor = NB Sons).
- Supabase project id: `cngsjtthiexcfpjpcpsg` (use via Supabase MCP).

## 1. What's already in place (don't redo)
- **Per-page metadata** via `generateMetadata` on PDP, shop/category, brand, tag,
  collection, blog, CMS pages. Products have `seo_title` / `seo_description`
  columns; when blank, `src/app/product/[slug]/page.tsx` auto-builds a decent
  meta from `short_description`/name. Brand rows also have `seo_title` /
  `seo_description`.
- **Structured data** (`src/lib/seo.ts`): Product, Breadcrumb, FAQPage,
  ItemList, OfferShippingDetails/returns. FAQ JSON-LD on PDP + category + CMS
  pages, kept in sync with visible copy.
- **Discovery surfaces:** `sitemap.xml`, `robots.txt`, `llms.txt` (all dynamic),
  Google Merchant + Meta Catalog product feeds (`/feeds/*`).
- **Category landing copy:** unique intro per taxon + leaf category in
  `CATEGORY_DESCRIPTIONS` (`src/lib/category-taxonomy.ts`) — reused as the
  category page meta description, so no duplicate-meta problem.
- **Clean product descriptions:** this session rewrote ~34 NB Sons supplement
  descriptions + 7 combo packs into structured, compliant copy (intro / Supports
  bullets / Composition / Directions / disclaimer). The PDP renders this
  structure properly (`src/components/pdp/ProductDescription.tsx`).
- **Brand & tag pages** now have on-page sort + category filters
  (`src/components/shop/ProductBrowser.tsx`).

## 2. The actual SEO work for next session (with Semrush)
Suggested order. Semrush default `database` is `us`; **try `pk` first** for this
market and fall back to `us`/global if PK data is thin. Workflow per the MCP:
discovery tool → `get_report_schema` → `execute_report`.

1. **Keyword research** (`keyword_research`) for each pillar + top categories +
   key products and NB Sons concern terms (e.g. "vitamin c serum pakistan",
   "calcium supplement", "PCOS supplement", "ivy leaf cough syrup", brand
   names). Capture volume, difficulty, intent.
2. **Backfill `seo_title` / `seo_description`** for the **~91 products** that have
   none, keyword-informed (see query below). Prioritise in-stock + bestsellers.
   Also tighten category/taxon and brand `seo_title`/`seo_description`.
3. **Technical site audit** (`siteaudit_research` / `projects_research`) on
   yellowpink.pk → fix crawl/meta/structured-data issues it surfaces.
4. **Competitor / organic research** (`organic_research`, `overview_research`)
   on PK beauty + supplement e-com competitors → keyword gaps + content ideas.
5. **Backlinks** (`backlink_research`) → outreach/PR targets.
6. **Content gaps → blog** (there's a working blog at `/blog`): map informational
   keywords to articles (e.g. "best supplements for …", routines, ingredient
   explainers) and internally link to PDPs/categories.
7. **Rank tracking** (`tracking_research`) for the target keyword set.

Helpful query — products missing meta (run via Supabase MCP):
```sql
select slug, name, category, brand
from products
where status='published'
  and (seo_title is null or btrim(seo_title)='' or seo_description is null or btrim(seo_description)='')
order by is_bestseller desc, category;
```

## 3. Known issues / follow-ups to fold in
- **`hello@yellowpink.pk` has no incoming mail set up** (owner confirmed). Until
  it does, customer "email us" paths are dead. **Build an admin-side inbox**:
  a storefront contact form (`/page/contact` / a Contact form component) that
  writes to a new `contact_messages` table, surfaced under a new **Admin →
  Messages** section (mirror the pattern of `order_notes` / the reviews admin).
  Optionally wire Resend (already used for outbound) to forward submissions to
  the owner's real address. This unblocks the "Questions? email us" CTAs.
- **Cross-cutting categories:** a few supplements have no perfect taxonomy
  bucket (sleep/melatonin `puratin`, brain `citowit`, magnesium `calco-fit`).
  Consider adding concerns (e.g. "Sleep & Stress", "Brain & Focus") to
  `category-taxonomy.ts`, or leave. (S-Lyte, NB CAL, Asco-C, Energy Boost were
  already re-filed this session.)
- **Welcome offer copy** ("WELCOME10 — 10% off over PKR 1,500") is still typed as
  literals in `NewsletterSignup` + the reorder email, while the live values are
  in the WELCOME10 coupon (`getWelcomeOffer`). Wire them dynamic like the
  shipping/returns figures were.
- **Combo bundle images** (`/public/combos/*`) are real component photos on a
  cream canvas; product white-bg shows as panels — optional `sharp.trim()`
  polish.

## 4. How this repo ships (process)
- Branch per change (`claude/<topic>`), PR to `main`, **Vercel auto-deploys main**.
  Pages are ISR (`revalidate = 300`) + CDN — content edits show within ~5 min.
- **DB:** product/brand/page content and settings live in Supabase (admin-
  editable), edited via the Supabase MCP. Schema changes go in
  `supabase/migrations/` (latest applied: `20260621_160_nb_sons_and_combos.sql`).
- **Deploy-order rule:** never point the shared prod DB at a `/public` asset
  that isn't merged to `main` yet (it 404s). Ship the file, then update the
  pointer.
- **Commit trailers:** `Co-Authored-By: Claude <noreply@anthropic.com>` +
  `Claude-Session:` line. Don't put model identifiers in commits/PRs.

## 5. Key files
- Metadata/JSON-LD: `src/lib/seo.ts`
- Taxonomy + category copy: `src/lib/category-taxonomy.ts`
- PDP: `src/sections/pdp/PDPPage.tsx`, `src/components/pdp/ProductDescription.tsx`
- Shop filtering: `src/sections/collection/CollectionPage.tsx`;
  brand/tag browser: `src/components/shop/ProductBrowser.tsx`
- Brand helpers: `src/lib/brands.ts`; feeds: `src/app/feeds/*`
- llms/robots/sitemap: `src/app/llms.txt`, `src/app/robots.txt`, `src/app/sitemap.xml`
- End-user manual (keep accurate): `docs/USER-MANUAL.md`
