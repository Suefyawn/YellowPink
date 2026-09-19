# SEO baselines for the Cloudflare migration

Captured 19 Sep 2026, the day before the migration work started, so every
cutover can be checked against "what Google saw on Vercel". The rules these
files enforce are in the migration plan (no URL changes, parity gate, never
cache a failure, measure before and after).

| File | What | How to refresh |
| --- | --- | --- |
| `semrush-organic-pk-<date>.csv` | Every keyword the domain ranks for in Semrush's Pakistan database (keyword; position; volume; URL; traffic). 747 rows, 240 est. visits/month. | Semrush session: `resource_organic`, target `yellowpink.pk`, database `pk`, `display_limit` 800, sorted by traffic. |
| `crawl-<date>-browser.json`, `crawl-<date>-googlebot.json` | Full crawl of the sitemap plus every redirect source: status, final URL, title, canonical, description, robots, H1, JSON-LD types, Article dates, OG image, counts. | `npx tsx scripts/seo-parity.ts --a https://www.yellowpink.pk --save docs/seo/crawl-<date>-browser.json` (and `--ua googlebot`). |
| `redirect-sources.txt` | The paths the crawl replays: the `redirects` table, `next.config.ts` redirects and the WordPress patterns in `src/proxy.ts`. | Regenerate from the table before each cutover (the header line says how). |
| `snapshot-<date>.json` | Search Console 7-day clicks/impressions/position, field Core Web Vitals p75, GSC index-status counts, the rank tracker's last run, Semrush totals per URL. | `npx tsx scripts/seo-snapshot.ts --semrush docs/seo/semrush-organic-pk-<date>.csv` (needs `.env.local`). |

## Cadence

- Day before a cutover: new crawl (both user agents) and snapshot.
- Cutover night: `seo-parity --a <saved crawl> --b https://www.yellowpink.pk` must report 0 diffs apart from the known product-rail jitter (related-product rails differ by one or two images between requests).
- Day after and weekly for four weeks: `seo-snapshot --compare <previous snapshot>`. Any alarm is a rollback trigger.

## Known, accepted

- Site Audit flags the `Content-Signal:` line in robots.txt as malformed. It is the Cloudflare content-signals standard; Google ignores unknown directives.
- 378 `/go/whatsapp?…` links are blocked by robots on purpose.
- The two "broken external links" (WHO EMHJ, NIH calcium fact sheet) answer 200 and 403-to-bots respectively in a browser; both are left as citations.
