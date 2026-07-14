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

# Icons

Admin sidebar and storefront chrome use inline SVG icons (lucide-style:
24×24 viewBox, `stroke="currentColor"`, `strokeWidth="2"`, rendered at
14px or 16px). Do **not** introduce emoji as navigation icons — they pick
up the OS emoji font and clash with the brand. Inherit colour from the
parent via `currentColor`.
