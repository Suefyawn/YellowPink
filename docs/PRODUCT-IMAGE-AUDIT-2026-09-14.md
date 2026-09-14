# Product cover audit — 14 September 2026

Measured every product cover rendered on the eight new collection pages
(`/collection/sunscreens`, `moisturizers`, `serums`, `blushes`, `cleansers`,
`lip-products`, `hair-care`, `makeup-brushes`): 81 covers, fetched and measured
at source. Written up because the owner reported "some have weird bad images"
on collection cards.

## What was wrong (fixed in code)

The tile box is a square (`aspectRatio: '1'` in `ProductTile`) and the image was
drawn with `object-fit: cover`, so anything that was not square got
centre-cropped to fit.

**16 of the 81 covers were being cropped**, losing between 5% and 26% of the
picture. For a tall bottle that is the cap and the base:

| Loss | Size | Product |
|---|---|---|
| ~26% | 1440×1952 | Rare Beauty Soft Pinch Liquid Blush (Hope) |
| ~25% | 1200×1598 | SHEGLAM Dynamatte Boom Lipstick |
| ~25% | 1340×1785 | SHEGLAM Color Bloom Liquid Blush |
| ~25% | 1200×1600 | DRMTLGY Universal Tinted Moisturizer SPF 46 |
| ~25% | 900×1200 | La Roche-Posay Anthelios UVMune 400 |
| ~25% | 900×1200 | La Roche-Posay Cicaplast Baume B5+ |
| ~25% | 901×1200 | SHEGLAM Buttery Bliss Blush Stick |
| ~25% | 901×1200 | SHEGLAM Pout-Perfect Lip Plumper |
| ~25% | 800×1067 | COSRX Advanced Snail 96 Mucin Power Essence |
| ~20% | 900×1125 | CeraVe Moisturizing Cream 454g |
| ~20% | 900×1125 | CeraVe Hydrating Facial Cleanser |
| ~20% | 900×1125 | CeraVe Moisturizing Cream 340g |
| ~19% | 1080×1328 | CeraVe Daily Moisturizing Lotion |
| ~14% | 1029×1200 | Huda Beauty Faux Filler Lip Gloss |
| ~8%  | 800×865  | Dior Backstage Rosy Glow Powder Blush |
| ~5%  | 735×700  | CeraVe Sheer Tint Sunscreen SPF 30 |

**Fix applied:** the tile now draws with `object-fit: contain`. The other 65
covers are exactly 1:1 and render identically either way (a square image fills a
square box under both rules), so this changes nothing for the majority and stops
the cropping for these 16. They letterbox onto the tile's existing cream ground,
which reads as deliberate. The PDP hero already used `contain` for this reason.

## What still needs a person (owner action)

### Low-resolution covers
Twelve covers are under 900px on the short edge, against a 900–1200px norm for
the rest of the catalogue. They are not broken, but they look soft next to their
neighbours on a phone at 2x or 3x. Worth re-sourcing when convenient:

| Size | Product |
|---|---|
| 600×600 | Pixi LipGlow Tinted Lip Balm |
| 660×660 | Makeup Revolution Superdewy Liquid Blush |
| 735×700 | CeraVe Sheer Tint Sunscreen SPF 30 |
| 736×736 | Rhode Peptide Lip Tints |
| 736×736 | CeraVe Acne Control Cleanser |
| 736×736 | NARS Afterglow Liquid Blush |
| 800×800 | Beauty of Joseon Relief Sun (Rice + Probiotics) |
| 800×800 | Beauty of Joseon Relief Sun Aqua-Fresh |
| 800×800 | **OGX Argan Oil of Morocco Hair Mask** |
| 800×800 | NARS Light Reflecting Foundation |
| 800×865 | Dior Backstage Rosy Glow |
| 800×1067 | COSRX Advanced Snail 96 Mucin Essence |

### The Argan hair mask specifically
The owner asked for this one to be changed. Measured: **800×800, 1:1, 38KB** — so
it was never one of the cropped covers, and the tile fix does not change it. The
geometry is fine; what is wrong is the photograph itself, plus a resolution below
the catalogue norm. This needs a real replacement image, either OGX's own brand
asset or a photo of the actual stock. It is a real branded product, so the
replacement has to be a genuine photo of it, not a generated one.

## Method

Images were fetched from source and measured with `sharp`, not inferred from
the markup, so the numbers are the real pixel dimensions being served. Nothing
in the catalogue is missing an image: all 240 published products have one, all
on `images.yellowpink.pk` or `www.yellowpink.pk`, all HTTPS, none proxied.
