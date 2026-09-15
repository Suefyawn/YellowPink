# Where product photographs come from

Last updated: 15 September 2026

Two sets of products need pictures:

- **The ten imported hair drafts** (`HAIR-CATALOGUE-DRAFTS-2026-09-14.md`) have
  no image at all and cannot be published without one.
- **Twelve live products** have covers under 900px on the short edge, against a
  900–1200px norm for the rest of the catalogue. They are not broken, just soft
  next to their neighbours on a phone. The list is at the end of
  `PRODUCT-IMAGE-AUDIT-2026-09-14.md`.

The instruction was to find them on vendor websites or other sellers. Those are
two different things, and only one of them is safe.

## The short version

| Source | Use it? |
|---|---|
| The distributor's retailer asset pack | **Yes.** Best quality, explicitly licensed, free. Start here. |
| The brand's own global site, as an authorised stockist | **Yes, with the supplier's written OK.** Standard retail practice. |
| Photograph the stock yourself | **Yes.** Costs nothing and the images are unique, which helps in search. |
| Open Beauty Facts and similar open databases | Rarely. Openly licensed but tested below and too small. |
| Another shop's product listing | **No.** Explained at the bottom. |

---

## Route 1 — ask the distributor (start here)

Every one of these brands reaches Pakistan through a distributor, and supplying
retailers with product imagery is part of what a distributor does. The pack is
usually high-resolution, already cut out on white, and correct for the regional
packaging — which matters, because the bottle on CeraVe's American site is not
always the bottle that arrives in the carton here.

It is a ten-minute email and it settles the licence question at the same time.
Send this to each supplier:

> Subject: Product images for our online store
>
> Hello,
>
> We stock your products at Yellow Pink (yellowpink.pk) and are listing several
> more of your lines this month.
>
> Could you send us your retailer image pack for the products below? White
> background and 1200px or larger is ideal. If there is a partner portal we
> should be using instead, please point us to it.
>
> We would also like to confirm in writing that we may use your official
> product images on our store listings and in our social posts.
>
> [list the products]
>
> Thank you,
> [name], Yellow Pink

Ask about the twelve soft covers in the same message. Most of them are brands
already supplied: CeraVe, Beauty of Joseon, PIXI, NARS, Rhode, Makeup
Revolution, OGX.

## Route 2 — the brand's own site

As an authorised stockist, using a brand's official product image is ordinary
retail practice, and most brands prefer it to a home-made photograph of their
packaging. The permission comes from the supplier relationship, not from the
image being visible on the web, so get the one-line confirmation in the email
above rather than assuming it.

All of these publish official product imagery: cerave.com, ogxbeauty.com,
theordinary.com, olaplex.com, laroche-posay.com.

## Route 3 — photograph them yourself

Worth doing even if Route 1 works, because unique photographs are worth more in
search than the same manufacturer render every competing shop is using. Google
groups identical product images across merchants; a picture nobody else has
cannot be grouped away.

What it takes, using a phone:

- A sheet of white A2 card, curved up a wall so there is no corner line behind
  the product.
- Daylight from a window at the side, not the front. No flash, no ceiling
  light. Overcast days are better than sunny ones.
- Phone on anything that holds it still, product filling most of the frame,
  label facing straight at the camera.
- Tap the label to focus, and drag exposure down slightly so the white stays
  white rather than blowing out.
- Shoot square, or crop square afterwards. The tile is square; the product page
  letterboxes anything else onto cream.

Twenty minutes gets through a dozen products at well over 1200px.

## What we are not doing, and why

Taking product photographs from another shop's listing is not on. They are that
shop's own photographs and copying them is copyright infringement, whatever the
practice is locally. That is the whole of the reason and it does not need
elaborating.

There are two practical costs on top of the legal one, which matter even if
nobody ever complains:

- **Search.** Duplicate images get collapsed. A copied photograph competes
  against the original and generally loses, so the effort buys a listing that
  is harder to find than one with no image problem at all.
- **The wrong bottle.** Other shops' photographs are often the wrong regional
  packaging, a discontinued design, or a different size. Customers notice when
  the parcel does not match the picture, and on cash on delivery they refuse it
  at the door, which costs the courier round trip.

## What was tested and rejected

**Open Beauty Facts** (`world.openbeautyfacts.org`) is a real option on paper:
an open product database whose photographs are CC-BY-SA licensed, so they can
be reused with attribution. It was checked against all ten hair drafts.

Three of the ten had any match at all, and the images are crowd-sourced phone
snapshots of physical packages rather than studio shots. The best one found,
for the OGX Argan Oil shampoo, is **338×600 at full size** — smaller than the
twelve covers already flagged as too soft, and photographed on a kitchen
counter. It would make the catalogue worse.

Not worth the attribution footer. Mentioned here only so nobody re-investigates
it in six months.

## The specification

When the images arrive, before uploading:

- **Square, 1200×1200**, or as close as the source allows. The tile is square
  and the product page letterboxes anything else onto cream, which reads as
  deliberate but wastes the space.
- **White or very light background.** The store's ground is cream (`#FAF6EE`),
  so pure white sits fine; a coloured lifestyle shot fights every tile around
  it.
- **WebP**, quality 80–85. The resizer converts anyway, but starting from a
  bloated PNG wastes storage.
- **Upload, do not hotlink.** The `/img` resizer only accepts our own domain
  and our storage, by design: an image on someone else's CDN disappears the day
  they reorganise their site, and the product page is then broken with no
  warning.

One thing not worth trying: enlarging the twelve soft covers in software. The
resizer already refuses to upscale past the original (`&we` on every request),
which is correct — enlarging a 600px photograph produces a 1200px blurry
photograph. There are no pixels to recover. New originals are the only fix.
