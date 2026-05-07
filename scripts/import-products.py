#!/usr/bin/env python3
"""
WooCommerce → Supabase product importer for YellowPink.
Reads the WC CSV export and inserts products into the Supabase products table.
- simple products → 1 row each
- variable parents → skipped (variations hold the data)
- variation products → 1 row each (inherits parent's brand/category/description)
"""

import csv
import json
import re
import urllib.request
import urllib.error
import html
import sys

SUPABASE_URL  = 'https://cngsjtthiexcfpjpcpsg.supabase.co'
SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuZ3NqdHRoaWV4Y2ZwanBjcHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNTI4ODgsImV4cCI6MjA5MzYyODg4OH0.vcQqOr5hvpFJbmschr7MmriQ0z6Pl1KHq7PS6BpvY0g'
CSV_PATH      = '/root/.claude/uploads/1a18c4fd-e294-45a4-b810-cd4592ac933d/a360782b-wcproductexport7520261778146482759.csv'

# ── helpers ──────────────────────────────────────────────────────────────────

def strip_html(text):
    if not text:
        return ''
    text = re.sub(r'<(script|style)[^>]*>.*?</(script|style)>', '', text,
                  flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<(br|p|div|li|h[1-6]|ul|ol)[^>]*/?>',  ' ', text, flags=re.IGNORECASE)
    text = re.sub(r'</(p|div|li|ul|ol|h[1-6])>',            ' ', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    text = html.unescape(text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n\s*\n', '\n', text)
    return text.strip()

def first_sentence(text, max_len=320):
    """Return the first meaningful sentence(s), up to max_len chars."""
    if not text:
        return ''
    if len(text) <= max_len:
        return text
    # Try to cut at a sentence boundary
    trunc = text[:max_len]
    for sep in ('. ', '! ', '? ', '.\n'):
        idx = trunc.rfind(sep)
        if idx > max_len // 2:
            return trunc[:idx + 1].strip()
    return trunc.rstrip() + '…'

def clean_name(name):
    """Strip WooCommerce housekeeping suffixes from product names."""
    name = re.sub(r'\s*\(All Shades?\)\s*', '', name)
    name = re.sub(r'\s*\(All Shades? Available\)\s*', '', name)
    name = re.sub(r'\s*\(All Sizes?\)\s*', '', name)
    name = re.sub(r'\s*\(All Colors?\)\s*', '', name)
    name = re.sub(r'\s*-\s*Copy$', '', name, flags=re.IGNORECASE)
    return name.strip()

def to_slug(text):
    text = text.lower()
    text = re.sub(r'&amp;', 'and', text)
    text = re.sub(r'&\w+;', '', text)
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

def unique_slug(base, seen):
    if base not in seen:
        seen.add(base); return base
    i = 2
    while f'{base}-{i}' in seen:
        i += 1
    seen.add(f'{base}-{i}')
    return f'{base}-{i}'

def first_image(img_str):
    if not img_str:
        return None
    for part in img_str.split(','):
        url = part.strip()
        if url.startswith('http'):
            return url
    return None

def parse_price(s):
    s = s.strip()
    if not s:
        return None
    try:
        return int(float(s))
    except ValueError:
        return None

# ── category mapping ─────────────────────────────────────────────────────────

CATEGORY_MAP = {
    'Skincare':                        'Skincare',
    'Moisturizers, Skincare':          'Skincare',
    'Skin Makeup, Skincare':           'Skincare',
    'Skincare, Sunscreens':            'Skincare',
    'Budget Bundles, Moisturizers, Skincare': 'Skincare',
    'Budget Bundles, Skincare':        'Skincare',

    'Lip & Cheek Tints':               'Makeup',
    'Lip & Cheek Tints, Contour Sticks': 'Makeup',
    'Lip & Cheek Tints, Skin Makeup':  'Makeup',
    'Budget Bundles, Lip & Cheek Tints': 'Makeup',
    'Highlighters':                    'Makeup',
    'Eyeshadow':                       'Makeup',
    'Foundations, Skin Makeup':        'Makeup',
    'Skin Makeup':                     'Makeup',
    'Brushes':                         'Makeup',
    'Budget Bundles':                  'Makeup',
    'Budget Bundles, Skin Makeup':     'Makeup',
    'Combo Packs':                     'Makeup',

    'Hair Care':                       'Wellness',
    'Energy & Performance':            'Wellness',
    'Immune Support':                  'Wellness',
    'Immune Support, Digestive Health & Weight Management': 'Wellness',
    'Bone Health, Health & Wellness':  'Wellness',
    'Brain Health, Health & Wellness': 'Wellness',
    'Heart & Cardiovascular':          'Wellness',
    'Human Health':                    'Wellness',
    'Human Health, Digestive Health & Weight Management': 'Wellness',
    'Human Health, Female Fertility & Prenatal Health': 'Wellness',
    'Human Health, Female Fertility & Reproductive Health': 'Wellness',
    'Human Health, General Wellness':  'Wellness',
    'Human Health, Health & Wellness': 'Wellness',
    'Human Health, Immune Support':    'Wellness',
    'Human Health, Immunity & Wellness': 'Wellness',
    'Human Health, Male Fertility':    'Wellness',
    'Human Health, Male Fertility & Cardiovascular Health': 'Wellness',
    'Human Health, Male Vitality & Performance': 'Wellness',
    'Human Health, Male Vitality & Stamina': 'Wellness',
    'Human Health, Pediatric Health':  'Wellness',
    "Human Health, Reproductive Health, Women's Health": 'Wellness',
    'Health & Wellness, Bone Health':  'Wellness',
    "Women's Health, Bone Health":     'Wellness',
    "Women's Health, Electrolyte Balance": 'Wellness',
    "Women's Health, Health & Wellness": 'Wellness',
    "Women's Health, Immunity & Wellness": 'Wellness',
    "Women's Health, Pediatric Health": 'Wellness',
    "Women's Health, Sleep & Relaxation": 'Wellness',
    "Women's Health, Female Fertility & Reproductive Health": 'Wellness',
}

def map_category(wc_cat):
    if not wc_cat:
        return 'Skincare'
    if wc_cat in CATEGORY_MAP:
        return CATEGORY_MAP[wc_cat]
    lo = wc_cat.lower()
    if any(k in lo for k in ('health', 'wellness', 'fertility', 'immune', 'hair',
                              'energy', 'bone', 'vitamin', 'supplement', 'pediatric',
                              'digestive', 'cardiovascular', 'reproductive', 'vitality',
                              'sleep', 'electrolyte')):
        return 'Wellness'
    if any(k in lo for k in ('makeup', 'blush', 'lip', 'tint', 'highlighter',
                              'foundation', 'eyeshadow', 'brush', 'contour',
                              'bundle', 'combo', 'concealer', 'lipstick')):
        return 'Makeup'
    return 'Skincare'

# tag = finer label shown as a badge (New / Sale / Bestseller / None)
BESTSELLER_CATEGORIES = {'Lip & Cheek Tints', 'Lip & Cheek Tints, Contour Sticks',
                          'Lip & Cheek Tints, Skin Makeup'}
FEATURED_BRANDS = {'PIXI', 'RHODE', 'NARS', 'CeraVe', 'SHEGLAM'}

# ── Supabase REST helper ──────────────────────────────────────────────────────

def sb_request(method, path, data=None, extra_headers=None):
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
    }
    if extra_headers:
        headers.update(extra_headers)
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# ── parse CSV ─────────────────────────────────────────────────────────────────

print('Reading CSV…')
rows = []
with open(CSV_PATH, newline='', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        rows.append(row)
print(f'  {len(rows)} data rows')

# Build parent lookup: wc_id → row, sku → row
parents = {}
for row in rows:
    if row['Type'].strip() == 'variable':
        wc_id = row['ID'].strip()
        sku   = row['SKU'].strip()
        parents[wc_id] = row
        if sku:
            parents[sku] = row

# ── build product list ────────────────────────────────────────────────────────

products = []
seen_slugs = set()
skipped = []

VARIANT_ATTR_NAMES = {'shade', 'color', 'colour', 'scent', 'size', 'volume',
                       'type', 'flavor', 'flavour'}

for row in rows:
    rtype   = row['Type'].strip()
    pub     = row['Published'].strip()
    wc_name = row['Name'].strip()

    # Skip: variable parents, drafts/copies, empty rows
    if rtype == 'variable' or pub == '-1' or not wc_name:
        continue
    if rtype not in ('simple', 'variation'):
        continue

    # ── get parent ──
    parent = None
    if rtype == 'variation':
        ref = row.get('Parent', '').strip()
        if ref.startswith('id:'):
            parent = parents.get(ref[3:])
        elif ref:
            parent = parents.get(ref)

    # ── name + variant ──
    if rtype == 'variation' and parent:
        name    = clean_name(parent['Name'].strip())
        attr_val = row.get('Attribute 1 value(s)', '').strip()
        if not attr_val and ' - ' in wc_name:
            attr_val = wc_name.rsplit(' - ', 1)[1].strip()
        variant = attr_val or None
    else:
        name = clean_name(wc_name)
        a1_name = row.get('Attribute 1 name', '').strip().lower()
        a1_val  = row.get('Attribute 1 value(s)', '').strip()
        # Use attribute as variant only when it's a true product variant
        if a1_name in VARIANT_ATTR_NAMES and a1_val and ',' not in a1_val:
            variant = a1_val
        else:
            variant = None

    # ── brand ──
    brand = row.get('Brands', '').strip()
    if not brand and parent:
        brand = parent.get('Brands', '').strip()
    if ',' in brand:
        brand = brand.split(',')[0].strip()
    if not brand:
        # infer from name
        for b in ['CeraVe', 'NARS', 'PIXI', 'SHEGLAM', 'RHODE', 'Tarte',
                  'Huda Beauty', 'Rare Beauty', 'Fenty Beauty', 'Kiko Milano',
                  'Anastasia Beverly Hills', 'Glow Recipe', 'DRMTLGY',
                  'Real Techniques', 'Makeup Revolution', 'Christine',
                  'Skin1004', 'BARUBT', 'ROZINO']:
            if b.lower() in name.lower() or b.lower() in wc_name.lower():
                brand = b; break
    if not brand:
        brand = 'YellowPink'

    # ── category ──
    wc_cat = row.get('Categories', '').strip()
    if not wc_cat and parent:
        wc_cat = parent.get('Categories', '').strip()
    category = map_category(wc_cat)

    # ── price ──
    sale_p = parse_price(row.get('Sale price', ''))
    reg_p  = parse_price(row.get('Regular price', ''))
    # Inherit from parent if blank (some variations have no price row)
    if sale_p is None and reg_p is None and parent:
        sale_p = parse_price(parent.get('Sale price', ''))
        reg_p  = parse_price(parent.get('Regular price', ''))

    if sale_p and reg_p and sale_p < reg_p:
        price          = sale_p
        original_price = reg_p
    elif sale_p:
        price          = sale_p
        original_price = None
    elif reg_p:
        price          = reg_p
        original_price = None
    else:
        price          = 0   # price unknown – will show as PKR 0, can fix in admin
        original_price = None

    # ── stock ──
    in_stock_str = row.get('In stock?', '1').strip()
    stock_str    = row.get('Stock', '').strip()
    stock = parse_price(stock_str)  # reuse int parser
    if in_stock_str == '0':
        stock = 0
    elif stock is None:
        stock = 50   # in-stock but no quantity set → assume plenty

    # ── image ──
    imgs = row.get('Images', '').strip()
    if not imgs and parent:
        imgs = parent.get('Images', '').strip()
    image_url = first_image(imgs)

    # ── description ──
    short = strip_html(row.get('Short description', '') or '').strip()
    long  = strip_html(row.get('Description', '') or '').strip()
    if not short and parent:
        short = strip_html(parent.get('Short description', '') or '').strip()
        long  = strip_html(parent.get('Description', '') or '').strip()
    description = first_sentence(short if short else long, max_len=320) or None

    # ── tag ──
    if original_price:
        tag = 'Sale'
    elif wc_cat in BESTSELLER_CATEGORIES:
        tag = 'Bestseller'
    elif brand in FEATURED_BRANDS and rtype == 'simple':
        tag = 'New'
    else:
        tag = None

    # ── slug ──
    slug_parts = [brand, name]
    if variant:
        slug_parts.append(variant)
    slug = unique_slug(to_slug('-'.join(slug_parts)), seen_slugs)

    products.append({
        'brand':          brand,
        'name':           name,
        'variant':        variant,
        'price':          price,
        'original_price': original_price,
        'category':       category,
        'tag':            tag,
        'slug':           slug,
        'stock':          stock,
        'image_url':      image_url,
        'description':    description,
    })

print(f'  Built {len(products)} products to import')
print()

# Quick preview
print('Preview (first 10):')
for p in products[:10]:
    print(f"  [{p['category']:8}] {p['brand']:20} | {p['name'][:35]:35} | {p['variant'] or '':15} | PKR {p['price']:>5}")
print('  …')
print()

# ── clear existing products ───────────────────────────────────────────────────

print('Clearing existing products table…')
status, body = sb_request('DELETE', 'products?id=not.is.null')
if status in (200, 204):
    print(f'  Cleared (status {status})')
else:
    print(f'  Note: DELETE returned {status}: {body[:120]}')
    print('  (Continuing anyway — will upsert)')

# ── insert in batches ─────────────────────────────────────────────────────────

BATCH = 50
ok_count  = 0
err_count = 0

print(f'\nInserting {len(products)} products in batches of {BATCH}…')
for i in range(0, len(products), BATCH):
    batch  = products[i:i + BATCH]
    status, body = sb_request(
        'POST', 'products',
        data=batch,
        extra_headers={'Prefer': 'return=minimal'},
    )
    if status in (200, 201):
        ok_count += len(batch)
        print(f'  Batch {i//BATCH+1}: ✓ {len(batch)} inserted')
    else:
        err_count += len(batch)
        print(f'  Batch {i//BATCH+1}: ✗ status {status}')
        print(f'    {body[:300]}')

print()
print(f'Done. Inserted: {ok_count}  Errors: {err_count}')
if err_count:
    print('Check errors above — may need service role key for bulk delete.')
    sys.exit(1)
