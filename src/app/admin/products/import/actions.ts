'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { revalidateStorefrontCatalog } from '@/lib/revalidate-storefront';
import { productInputSchema } from '@/lib/validators';
// Pure CSV parsing + row mapping lives in @/lib/product-csv: a 'use server'
// module can only export async actions, and those helpers need unit tests.
import { parseCsv, normaliseRow } from '@/lib/product-csv';

export interface ImportResult {
  parsed: number;
  imported: number;
  skipped: number;
  errors: string[];
}

export async function importProductsFromCsv(csvText: string): Promise<ImportResult> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products.edit'))) {
    return { parsed: 0, imported: 0, skipped: 0, errors: ['Unauthorized'] };
  }

  const rows = parseCsv(csvText);
  const errors: string[] = [];
  const valid: Record<string, unknown>[] = [];

  for (const [i, r] of rows.entries()) {
    const norm = normaliseRow(r);
    if (!norm) { errors.push(`row ${i + 2}: missing brand/name/price`); continue; }
    const parsed = productInputSchema.safeParse(norm);
    if (!parsed.success) {
      errors.push(`row ${i + 2}: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
      continue;
    }
    valid.push(parsed.data as Record<string, unknown>);
  }

  let imported = 0;
  for (let i = 0; i < valid.length; i += 50) {
    const batch = valid.slice(i, i + 50);
    // Service role: `products` has no anon insert/update policy, so the anon
    // client's upsert was silently blocked by RLS and imported nothing. The
    // staff-permission gate above authorises this write.
    const { error } = await supabaseAdmin().from('products').upsert(batch, { onConflict: 'slug' });
    if (error) {
      errors.push(`batch ${Math.floor(i / 50)}: ${error.message}`);
    } else {
      imported += batch.length;
    }
  }

  await logAudit(session, {
    action: 'product.bulk_csv_import',
    entity: 'product',
    diff: { parsed: rows.length, imported, skipped: rows.length - valid.length, errorCount: errors.length },
  });

  revalidatePath('/admin/products');
  if (imported > 0) revalidateStorefrontCatalog();
  return { parsed: rows.length, imported, skipped: rows.length - valid.length, errors: errors.slice(0, 20) };
}
