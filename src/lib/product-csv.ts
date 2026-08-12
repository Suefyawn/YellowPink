// Pure CSV → product-row mapping for the admin Import CSV screen.
//
// This lives outside the 'use server' action module for two reasons: every
// export of a 'use server' file has to be an async server action, and these
// helpers are the part worth unit-testing (a blank cell that means "leave it
// alone" versus one that means "set it to zero" is the difference between a
// costing pass and a catalogue-wide wipe).

export type CsvRow = Record<string, string>;

export function toSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Best-effort CSV row parser. */
export function parseCsv(text: string): CsvRow[] {
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        cur.push(field); lines.push(cur); cur = []; field = '';
      } else { field += c; }
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); lines.push(cur); }
  if (lines.length < 2) return [];
  // trim() also eats the UTF-8 BOM the export endpoint writes for Excel, so a
  // round-tripped file still resolves its first header ("slug") by name.
  const header = lines[0].map(h => h.trim());
  return lines.slice(1).filter(r => r.some(c => c.trim() !== '')).map(r => {
    const obj: CsvRow = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = (r[j] ?? '').trim();
    return obj;
  });
}

/** First finite number among the given raw cells, treating empty/blank as
 *  absent. `Number('')` is 0, so a plain `?? Number(...)` chain turns an empty
 *  'Sale price' column into a free product — this skips blanks instead. */
export function num(...cells: (string | undefined)[]): number | null {
  for (const c of cells) {
    if (c == null) continue;
    const t = c.trim();
    if (t === '') continue;
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function normaliseRow(r: CsvRow): Record<string, unknown> | null {
  const brand   = r.brand || r.Brand || r['Brand Name'];
  const name    = r.name  || r.Name  || r['Product Name'];
  const slug    = r.slug || r.Slug || toSlug(`${brand ?? ''} ${name ?? ''}`);
  const category = r.category || r.Category || r.Categories || 'Uncategorized';

  // Price: an explicit `price`, else a genuine WooCommerce 'Sale price', else
  // the 'Regular price'. An EMPTY 'Sale price' (the export shape for a product
  // that is NOT on sale) must fall through to the regular price, never 0.
  const salePrice = num(r['Sale price']);
  const regularPrice = num(r['Regular price']);
  const price = num(r.price, r.Price) ?? salePrice ?? regularPrice;
  // When a real sale price sits below the regular price, keep the regular
  // price as the struck-through original so the sale badge renders.
  const original = num(r.original_price)
    ?? (salePrice != null && regularPrice != null && regularPrice > salePrice ? regularPrice : null);

  if (!brand || !name || price == null) return null;

  const cost = num(r.cost_price, r['Cost price']);

  return {
    brand: brand.trim(),
    name: name.trim(),
    slug,
    category: category.trim().split(',')[0].trim(),
    subcategory: r.subcategory || null,
    tag: r.tag || null,
    price,
    original_price: original,
    stock: r.stock ? Number(r.stock) : 0,
    image_url: r.image_url || r['Images']?.split(',')[0]?.trim() || null,
    description: r.description || r.Description || null,
    short_description: r.short_description || r['Short description'] || null,
    how_to_use: r.how_to_use || null,
    ingredients: r.ingredients || null,
    kind: r.kind ?? 'simple',
    // Round-trip columns emitted by the Export CSV endpoint. Absent or blank
    // cells keep today's behaviour (status untouched on existing rows,
    // inventory tracking defaulting on).
    variant: r.variant || null,
    // cost_price is spread in only when the cell has a value. Sending null for
    // a blank cell would wipe costs the sheet's author never touched, and a
    // costing pass usually fills a subset of rows at a time.
    ...(cost != null ? { cost_price: cost } : {}),
    ...(['draft', 'published', 'archived'].includes(r.status) ? { status: r.status } : {}),
    ...(r.track_inventory === 'true' || r.track_inventory === 'false'
      ? { track_inventory: r.track_inventory }
      : {}),
  };
}
