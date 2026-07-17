'use server';

// Server actions for hiding terms from the Search-demand report. Bot noise,
// staff test queries and one-off typos would otherwise sit in the demand
// lists forever; hiding is reversible from the "Hidden terms" manager on the
// page. Gated on products.edit like the synonym map (same audience: whoever
// curates what the catalogue should answer).

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

export async function ignoreSearchTerm(term: string): Promise<void> {
  const session = await assertProducts();
  const t = term.trim().toLowerCase().slice(0, 120);
  if (!t) return;
  const { error } = await supabaseAdmin()
    .from('search_demand_ignores')
    .upsert({ term: t } as never, { onConflict: 'term' });
  if (error) {
    log.error('search_demand.ignore_failed', { error: error.message });
    throw new Error(error.message);
  }
  await logAudit(session, { action: 'search_demand.ignore', entity: 'search_term', entity_id: t });
  revalidatePath('/admin/search-demand');
}

export async function unignoreSearchTerm(term: string): Promise<void> {
  const session = await assertProducts();
  const { error } = await supabaseAdmin().from('search_demand_ignores').delete().eq('term', term.trim().toLowerCase());
  if (error) {
    log.error('search_demand.unignore_failed', { error: error.message });
    throw new Error(error.message);
  }
  await logAudit(session, { action: 'search_demand.unignore', entity: 'search_term', entity_id: term });
  revalidatePath('/admin/search-demand');
}
