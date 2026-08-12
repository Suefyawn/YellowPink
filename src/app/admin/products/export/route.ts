import { getStaffSession } from '@/lib/staff-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchAll } from '@/lib/fetch-all';

export const dynamic = 'force-dynamic';

// Full-catalogue CSV export, the other half of the Import CSV round-trip.
// Columns use the import's native names so an exported file can be edited in a
// spreadsheet (mass repricing, restocks, publishing sweeps) and re-imported
// as-is — the import upserts by slug.

// CSV-escape: quote cells containing comma, quote or newline; double inner quotes.
function cell(v: string | number | boolean | null | undefined): string {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

interface ExportRow {
  slug: string; brand: string | null; name: string; variant: string | null;
  category: string | null; subcategory: string | null; tag: string | null;
  price: number; original_price: number | null; cost_price: number | null;
  stock: number;
  track_inventory: boolean | null; status: string | null; kind: string | null;
  image_url: string | null; short_description: string | null;
  description: string | null; how_to_use: string | null; ingredients: string | null;
}

// cost_price rides along so a bulk costing pass (fill the column in Excel,
// re-import) is one round-trip instead of 300 admin form saves. Finance COGS
// reads it for own-stock items, so a catalogue with blank costs reports zero
// margin — which is exactly the state the Golden Pearl import arrived in.
const COLUMNS: Array<keyof ExportRow> = [
  'slug', 'brand', 'name', 'variant', 'category', 'subcategory', 'tag',
  'price', 'original_price', 'cost_price', 'stock', 'track_inventory', 'status', 'kind',
  'image_url', 'short_description', 'description', 'how_to_use', 'ingredients',
];

export async function GET() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products.view'))) {
    return new Response('Forbidden', { status: 403 });
  }

  // fetchAll: the catalogue is past PostgREST's silent 1000-row cap. The
  // select list is a literal (not COLUMNS.join) so supabase-js keeps the row
  // type — the two must list the same columns.
  const { data, error } = await fetchAll<ExportRow>(
    supabaseAdmin()
      .from('products')
      .select('slug, brand, name, variant, category, subcategory, tag, price, original_price, cost_price, stock, track_inventory, status, kind, image_url, short_description, description, how_to_use, ingredients')
      .order('slug'),
  );
  if (error) return new Response(`Export failed: ${error.message}`, { status: 500 });

  const lines = [COLUMNS.map(cell).join(',')];
  for (const r of data ?? []) {
    lines.push(COLUMNS.map(c => cell(r[c])).join(','));
  }
  // Leading BOM so Excel reads UTF-8; CRLF line endings for the same reason.
  const csv = '﻿' + lines.join('\r\n');
  const fname = `products-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Cache-Control': 'no-store',
    },
  });
}
