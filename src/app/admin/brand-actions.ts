'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';
import type { Permission } from '@/lib/permissions';

// Brands are a merchandising facet of the catalogue, like collections; ride
// the same products permission set.
async function assertProducts(action: 'edit' | 'view' = 'edit') {
  const session = await getStaffSession();
  const perm: Permission = action === 'view' ? 'products.view' : 'products.edit';
  if (!session || (!session.isOwner && !session.permissions.includes(perm))) {
    throw new Error('Unauthorized');
  }
  return session;
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const str = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();

export async function createBrand(formData: FormData): Promise<void> {
  const session = await assertProducts();
  const name = str(formData, 'name');
  if (!name) redirect('/admin/brands?error=' + encodeURIComponent('Name is required'));
  const slug = slugify(str(formData, 'slug') || name);
  const { data, error } = await supabaseAdmin()
    .from('brands')
    .insert({ name, slug, status: 'draft' })
    .select('id')
    .single();
  if (error) {
    log.error('brand.create_failed', { error: error.message });
    redirect('/admin/brands?error=' + encodeURIComponent(error.message));
  }
  await logAudit(session, { action: 'brand.create', entity: 'brand', entity_id: (data as { id: string }).id, diff: { name, slug } });
  redirect(`/admin/brands/${(data as { id: string }).id}`);
}

export async function updateBrand(id: string, formData: FormData): Promise<void> {
  const session = await assertProducts();
  const name = str(formData, 'name');
  // The slug controls the public /brand/<slug> URL AND the join key against
  // products.brand. Editing it after launch breaks the storefront link from
  // products to the brand metadata until product rows are renamed, so we
  // intentionally do not expose a slug field on the edit form — the slug is
  // set at creation and frozen here.
  const status = str(formData, 'status') === 'published' ? 'published' : 'draft';

  const patch = {
    name,
    description: str(formData, 'description') || null,
    logo_url: str(formData, 'logo_url') || null,
    hero_image_url: str(formData, 'hero_image_url') || null,
    status,
    seo_title: str(formData, 'seo_title') || null,
    seo_description: str(formData, 'seo_description') || null,
    sort_order: Number(str(formData, 'sort_order')) || 0,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin().from('brands').update(patch).eq('id', id);
  if (error) redirect(`/admin/brands/${id}?error=` + encodeURIComponent(error.message));
  await logAudit(session, { action: 'brand.update', entity: 'brand', entity_id: id, diff: patch });
  revalidatePath('/admin/brands');
  revalidatePath(`/admin/brands/${id}`);
  redirect(`/admin/brands/${id}?saved=1`);
}

export async function deleteBrand(formData: FormData): Promise<void> {
  const session = await assertProducts();
  const id = formData.get('id') as string;
  if (id) {
    // The brand metadata row goes away; products keep their .brand text, so
    // /brand/<slug> still resolves via the derived path. The landing page
    // reverts to the templated description with no logo or hero.
    const { error } = await supabaseAdmin().from('brands').delete().eq('id', id);
    if (!error) await logAudit(session, { action: 'brand.delete', entity: 'brand', entity_id: id });
  }
  revalidatePath('/admin/brands');
  redirect('/admin/brands?deleted=1');
}
