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
