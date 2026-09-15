<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# User manual

`docs/USER-MANUAL.md` is the end-user manual for the whole system — the
customer journey and how staff run the store and process sales. It is meant to
stay accurate.

When a change alters user-facing behaviour — the storefront flow, an admin
section, the order/fulfilment workflow, settings, roles, or payment options —
update `docs/USER-MANUAL.md` in the same change so the manual never drifts from
the product. Refresh its "Last updated" date when you do.

# Admin follows Shopify

Owner directive, 13 Aug 2026: wherever this store has an equivalent in
Shopify — products, variants/options, inventory, orders and fulfilment,
collections, discounts, customers — model the workflow, layout and
vocabulary on how Shopify does it. Shopify is the proven pattern; staff
and the owner already think in it. Before building or reworking any admin
surface with a Shopify counterpart, check how Shopify's admin handles it
and copy that shape, diverging only with a stated reason. Custom systems
with no Shopify equivalent (the outreach desk, quick answers, health
tools, vendor settlements, the cashbook…) are separate parts and free to
be their own thing.

# What we sell: imported, not cheap local

Owner directive, 14 Sep 2026: the catalogue focuses on **imported** brands.
Cheap local lines are not worth stocking here, whatever the search volume
behind them: the margin is too thin to be worth the shelf space, the
fulfilment effort or the brand association.

Concretely, when a gap is found in the catalogue, do **not** propose filling
it from the low-price local drafts (Hello Hair, Golden Pearl "Set and Touch"
and similar, roughly PKR 130-350). Those were archived on purpose. Propose
imported stock instead, and prefer brands the store already has a vendor
relationship with — CeraVe, La Roche-Posay, The Ordinary, OGX, Anua,
Medicube, SKIN1004, COSRX, Beauty of Joseon, PIXI — because sourcing one
more line from an existing supplier is far cheaper than opening a new one.

This is why some obvious collection and quiz gaps stay open rather than
being filled with whatever is nearest. An empty shelf is better than a
shelf of stock the owner does not want to sell.

# Cash on delivery stays, and stays unconditional

Owner directive, 15 Sep 2026: do **not** propose advance payment, a deposit,
or part-payment above a value threshold. "People shy away from the sale when
they see advanced payments." COD is how this market buys, and a checkout that
asks for money up front loses the order rather than securing it.

This will keep looking like an obvious fix, so it is written down. Roughly
31% of COD orders are cancelled (PKR 31,712 over 120 days), and any future
conversion analysis will surface that number and point at a deposit. The
answer is already no. The lever that IS available is confirmation: the
one-click confirm link in the order email (`/order/confirm`, shipped 14 Sep)
lets a customer confirm without talking to anyone, and that is the thing to
measure and improve.

# One brand image everywhere

Owner directive, 13 Aug 2026: the whole online presence carries one
consistent brand image — storefront, every email (transactional,
newsletter campaigns, outreach), invoices, social/share imagery, admin
chrome. The system:

- **Gradient signature**: `linear-gradient(90deg, #F7C948, #E8487F)`
  (brand yellow → brand pink), used as the thin top bar on emails and
  branded surfaces. Solid `#F7C948` is the fallback where gradients
  don't render.
- **Palette**: pink `#E8487F` (deep variant `#C5286A` for admin
  buttons), yellow `#F7C948`, cream paper `#FAF6EE`, ink `#111827`
  (body `#374151`, muted `#6b7280`).
- **Wordmark**: "Yellow Pink" in Georgia/serif next to the flower mark
  (`/icon-192.png`); UI text in the system sans stack.
- **Email**: everything goes through the branded shell in
  `src/lib/email.ts` (gradient bar, cream logo band, footer). Never
  send a bare-text email from any new path; marketing sends include
  the unsubscribe footer.

New surfaces reuse these tokens rather than inventing near-misses.

# Customer-facing copy

Write product descriptions, marketing messages, SEO text and any other
copy a shopper reads like a person, not a language model. Concretely: no
em-dashes (use a comma, colon, parenthesis or a new sentence), no "it's
not just X, it's Y" constructions, no tidy rule-of-three flourishes, no
"elevate/unleash/discover" openers. Plain, specific, confident sentences.

# Blog posts ship with their hero image

A new `blog_posts` row is not done until its hero exists. In the same work
session that inserts the post: generate the hero, write it to
`public/blog-heroes/<slug>.webp` (1216×688, webp), ship it in the same
PR/deploy, and set `image_url = '/blog-heroes/<slug>.webp'` on the row once
the deploy carrying the file is live. Never leave a published post with a
NULL `image_url` — the listing falls back to a plain monogram tile and the
post loses its social share image.

# People in imagery: no bindis, ever

The store serves Pakistan. Women in generated or sourced imagery must
**never** wear a bindi, sindoor, or any dot/marking on the forehead —
those are Indian/Hindu cultural markers, not Pakistani (owner directive,
4 Aug 2026). Image models add them to South Asian faces by default even
when told not to, so treat every face as suspect: zoom into the forehead
of each generated face at full resolution before shipping, and retouch
the dot out (sample nearby skin, feathered patch) or regenerate if one
is present. Prefer modest styling (dupatta or hijab where it fits the
scene) for editorial/health imagery.

# Icons

Admin sidebar and storefront chrome use inline SVG icons (lucide-style:
24×24 viewBox, `stroke="currentColor"`, `strokeWidth="2"`, rendered at
14px or 16px). Do **not** introduce emoji as navigation icons — they pick
up the OS emoji font and clash with the brand. Inherit colour from the
parent via `currentColor`.
