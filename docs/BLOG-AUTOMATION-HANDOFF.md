# Blog automation — operating handoff

Last updated: 1 September 2026

This is the operating guide for the automated blog pipeline that publishes one
post a day to yellowpink.pk, and for the twice-monthly SEO ranking check that
measures whether those posts are working.

## The moving parts

| Piece | What it is | Where |
|---|---|---|
| "Yellow Pink daily blog publish" | Claude Routine, fires daily 12:00 UTC (5pm PKT), fresh session per run | claude.ai Routines (trigger `trig_014bTfxM3oZ3QwgdozkoB84B`) |
| "Yellow Pink SEO ranking check" | Claude Routine, fires the 1st & 15th 05:00 UTC, persistent session | claude.ai Routines (trigger `trig_014f2KdL56S86T9d15h7CLEi`) |
| `/api/blog` | Token-authed create/list endpoint the automation publishes through | `src/app/api/blog/route.ts`, auth in `src/lib/blog-api.ts` |
| `/api/media` | Token-authed image upload (now normalises: EXIF-rotate, crop, WebP) | `src/app/api/media/route.ts`, pipeline in `src/lib/image-normalize.ts` |
| Reviewer auto-assign | DB trigger matches each health post to a Medical Review Board doctor by topic and emails them | migration `20260815_1220`, `src/lib/review-assignment.ts` |
| Rankings dashboard | Admin → SEO rankings, fed by `seo_ranking_snapshots` | `src/app/admin/seo-rankings` |

Both Routines run on the account's Claude subscription; the site itself does no
AI work, so blog automation adds nothing to the Vercel/Supabase/Resend bills.

## How a daily run works

1. Picks a keyword: Semrush (PK database) organic + gap research against the
   content pillars, deduped against existing posts via `GET /api/blog`.
2. Writes 1,200–1,800 words under the store's strict voice rules (no
   em-dashes, no AI-tell phrasing, PKR prices, internal links verified live).
3. Generates a hero image (no bindi/forehead markings, still-life or
   dupatta/hijab styling preferred), uploads via `/api/media` with
   `preset=hero` — the server crops to the canonical 1216×688 WebP.
4. Publishes via `POST /api/blog` (published, not draft). Blank `read_time`
   is derived server-side from the body.
5. Verifies the live URL, hero, meta and every link, then reports.

The reviewer auto-assign trigger then credits a board doctor for health topics
and emails them; posts without a manual reviewer arrive with
`review_status = NULL` and count as "pending review" in admin.

## Health as of 1 Sep 2026

- 258 posts, zero missing heroes, ~7–11 posts/week, last run succeeded.
- Blogs are the site's traffic engine: 7 of the top 10 pages are posts, and
  the fertility-supplement cluster is the only content ranking on Google
  page 1.
- 42 posts carry no review_status (auto-assign only backfills health topics
  it can match). Worth a monthly sweep in Admin → Blog to assign reviewers.

## Known issues and their fixes

**1. Supabase MCP scoped to the wrong project (OPEN — needs the owner).**
The Routine sessions' Supabase connector resolves to the JetNine project, so
`seo_tracked_keywords` / `seo_ranking_snapshots` in `cngsjtthiexcfpjpcpsg`
are unreadable from those runs. Consequences so far: the daily run works
around it (uses `/api/blog` for dedupe), but the **ranking check could not
append its 1 Sep snapshot batch** — the Admin → SEO rankings dashboard is
frozen at 15 Aug until this is fixed.
Fix: claude.ai → Settings → Connectors → Supabase → make sure the connection
covers the `yellowpink` project (or all projects), then fire the ranking
check Routine once manually.

**2. `/api/media` R2 411 on chunked uploads (FIXED in the 1 Sep deploy).**
The R2 PUT now sends an explicit Content-Length. The Routine prompt carries
a fallback for the window until that deploy is live.

**3. Hero sizing (IMPROVED).** `/api/media` with `preset=hero` now cover-crops
to 1216×688 WebP server-side; the Routine no longer needs to size images.

**4. The API token lives in the Routine prompt.** `BLOG_API_TOKEN` appears in
plaintext in the Routine (and therefore in run transcripts). Acceptable for
a single-operator store, but if it ever leaks: set a new value for
`BLOG_API_TOKEN` in Vercel env, then paste the new token into the Routine
prompt. Rotating it takes two minutes.

## Levers you may want to pull

- **Pace**: the June bulk push (76 posts in a week) has settled to ~1/day.
  At 258 posts, quality and internal linking now beat volume; if Google's
  crawl budget looks strained (48 "Discovered – not indexed" pages), consider
  dropping to 4–5/week and spending the difference on refreshing the posts
  that already rank at positions 5–15.
- **Topic steering**: the tracked keyword list (Admin → SEO rankings) is the
  Routine's step 1 input once the connector scoping is fixed. Add keywords
  there to steer what gets written.
- **Review coverage**: E-E-A-T is the moat for health content. The monthly
  sweep of unreviewed posts matters more than one extra post.

## If a run fails

Each run's transcript is in claude.ai (the Routine's run history). The
pattern so far: runs never half-publish — `/api/blog` is a single insert, so
a failed run means no post that day, and the next day's run is unaffected.
There is no retry Routine on purpose; a missed day is cheaper than a
double-post risk.
