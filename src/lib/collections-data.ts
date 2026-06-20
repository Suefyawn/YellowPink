// Storefront loader for published collections. Kept out of the big supabase.ts
// getter file so the collections feature stays self-contained.

import { supabase, isDemo } from '@/lib/supabase';
import type { Collection } from '@/lib/collections';

export async function getPublishedCollections(limit?: number): Promise<Collection[]> {
  if (isDemo) return [];
  let q = supabase.from('collections').select('*').eq('status', 'published').order('sort_order').order('title');
  if (limit) q = q.limit(limit);
  const { data } = await q;
  return (data ?? []) as Collection[];
}
