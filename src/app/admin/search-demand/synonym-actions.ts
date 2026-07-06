'use server';

// Server actions for the Search-demand synonym map. A synonym rewrites a
// searched term into the query that actually returns products (see
// search_products() + the search_synonyms table). Gated on products.edit,
// because it changes what the storefront search surfaces.

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';

async function assertProducts() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products.edit'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

const str = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();

export interface SynonymResult { ok: boolean; error?: string }

export async function addSearchSynonym(_prev: SynonymResult | null, formData: FormData): Promise<SynonymResult> {
  const session = await assertProducts();
  // Stored lower-cased so the RPC's lower(trim(query)) lookup always matches.
  const term = str(formData, 'term').toLowerCase().slice(0, 120);
  const canonical = str(formData, 'canonical').slice(0, 120);
  const note = str(formData, 'note').slice(0, 200) || null;

  if (!term || !canonical) return { ok: false, error: 'Both the searched term and what to search instead are required.' };
  if (term === canonical.toLowerCase()) return { ok: false, error: 'The term and its replacement are the same, no mapping needed.' };

  const { error } = await supabaseAdmin()
    .from('search_synonyms')
    .upsert({ term, canonical, note }, { onConflict: 'term' });
  if (error) {
    log.error('synonym.add_failed', { error: error.message });
    return { ok: false, error: error.message };
  }
  await logAudit(session, { action: 'search_synonym.set', entity: 'search_synonym', entity_id: term, diff: { canonical, note } });
  revalidatePath('/admin/search-demand');
  return { ok: true };
}

export async function deleteSearchSynonym(term: string): Promise<void> {
  const session = await assertProducts();
  const { error } = await supabaseAdmin().from('search_synonyms').delete().eq('term', term);
  if (error) {
    log.error('synonym.delete_failed', { error: error.message });
    throw new Error(error.message);
  }
  await logAudit(session, { action: 'search_synonym.delete', entity: 'search_synonym', entity_id: term });
  revalidatePath('/admin/search-demand');
}
