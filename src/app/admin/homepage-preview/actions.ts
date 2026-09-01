'use server';

// Rail management actions for "Today's homepage". The rails' logic stays in
// lib/merchandising — these actions only flip the two owner inputs it reads
// (products.is_featured, products.is_bestseller) and the Featured fill-up
// toggle, so curation happens where the owner can SEE today's rails instead
// of hunting products one by one in the catalogue.

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';

const PATH = '/admin/homepage-preview';

function bust() {
  revalidatePath(PATH);
  revalidatePath('/', 'page'); // the live homepage rails
}

/** Flip is_featured / is_bestseller on one product. */
export async function setRailFlag(formData: FormData): Promise<void> {
  const session = await assertPermission('products.edit');
  const id = (formData.get('id') as string) ?? '';
  const flag = (formData.get('flag') as string) ?? '';
  const on = (formData.get('on') as string) === '1';
  if (!id || (flag !== 'featured' && flag !== 'bestseller')) return;

  const column = flag === 'featured' ? 'is_featured' : 'is_bestseller';
  const { error } = await supabaseAdmin().from('products').update({ [column]: on }).eq('id', id);
  if (error) return;

  void logAudit(session, {
    action: `homepage.${flag}_${on ? 'on' : 'off'}`,
    entity: 'products',
    entity_id: id,
    diff: { [column]: on },
  });
  bust();
}

/** The Featured fill-up switch (settings.featured_fillup, default on). */
export async function setFeaturedFillup(formData: FormData): Promise<void> {
  const session = await assertPermission('products.edit');
  const on = (formData.get('on') as string) === '1';
  const { error } = await supabaseAdmin()
    .from('site_settings')
    .upsert({ key: 'featured_fillup', value: on ? 'true' : 'false' }, { onConflict: 'key' });
  if (error) return;
  void logAudit(session, { action: 'homepage.featured_fillup', entity: 'site_settings', diff: { featured_fillup: on } });
  bust();
}

export interface RailSearchHit {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  image_url: string | null;
  is_featured: boolean;
  is_bestseller: boolean;
}

/** Published-product search for the "add a product to this rail" box. */
export async function searchCatalogForRail(q: string): Promise<RailSearchHit[]> {
  await assertPermission('products.edit');
  const term = q.trim();
  if (term.length < 2) return [];
  const { data } = await supabaseAdmin()
    .from('products')
    .select('id, name, brand, price, image_url, is_featured, is_bestseller')
    .eq('status', 'published')
    .or(`name.ilike.%${term.replace(/[%,()]/g, '')}%,brand.ilike.%${term.replace(/[%,()]/g, '')}%`)
    .order('popularity_score', { ascending: false })
    .limit(8);
  return (data ?? []) as RailSearchHit[];
}
