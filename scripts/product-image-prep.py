from PIL import Image, ImageChops
import os, glob

OUT = 'out'; os.makedirs(OUT, exist_ok=True)
SIZE = 1200
WHITE = (255, 255, 255)

def flatten(im):
    im = im.convert('RGBA')
    bg = Image.new('RGBA', im.size, WHITE + (255,))
    return Image.alpha_composite(bg, im).convert('RGB')

def whiten_background(im, sat_max=26, val_min=205):
    """Push a near-neutral, light background to pure white.

    OGX's US packshots sit on a soft grey gradient ("cloudy-gradient" in the
    filename) while the EMEA ones are on white, so a grid mixing the two looks
    accidental. Only pixels that are BOTH desaturated and light are moved, so
    the bottle itself (saturated purple, blue, gold) is untouched. A blanket
    threshold would eat the bottle's own highlights.
    """
    import colorsys
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            mx, mn = max(r, g, b), min(r, g, b)
            sat = 0 if mx == 0 else (mx - mn) * 255 // mx
            if sat <= sat_max and mx >= val_min:
                px[x, y] = WHITE
    return im


def trim(im, tol=8):
    """Bounding box of non-white content."""
    bg = Image.new('RGB', im.size, WHITE)
    diff = ImageChops.difference(im, bg).convert('L').point(lambda p: 255 if p > tol else 0)
    return im.crop(diff.getbbox()) if diff.getbbox() else im

def square(im, pad=0.06):
    w, h = im.size
    side = int(max(w, h) * (1 + pad * 2))
    canvas = Image.new('RGB', (side, side), WHITE)
    canvas.paste(im, ((side - w) // 2, (side - h) // 2))
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)

# CeraVe packshots carry a "#1 dermatologist recommended" badge top-left and a
# survey footnote along the bottom. Both are US marketing furniture, not the
# product, and the footnote is illegible at tile size. Crop them away before
# trimming so the bounding box finds the bottle and nothing else.
WHITEN = {'ogx-biotin-collagen-shampoo'}

CROP = {
    'cerave-anti-dandruff-hydrating-shampoo':     (0.33, 0.00, 1.00, 0.88),
    'cerave-anti-dandruff-hydrating-conditioner': (0.33, 0.00, 1.00, 0.88),
}

for src in sorted(glob.glob('raw/*')):
    slug = os.path.splitext(os.path.basename(src))[0]
    im = flatten(Image.open(src))
    if slug in CROP:
        l, t, r, b = CROP[slug]
        w, h = im.size
        im = im.crop((int(w*l), int(h*t), int(w*r), int(h*b)))
    if slug in WHITEN:
        im = whiten_background(im)
    im = square(trim(im))
    dst = f'{OUT}/{slug}.webp'
    im.save(dst, 'WEBP', quality=88, method=6)
    print(f'{slug:50s} -> {im.size} {os.path.getsize(dst)//1024}KB')
