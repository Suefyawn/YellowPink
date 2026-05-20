'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';

export async function createCoupon(formData: FormData) {
  const session = await assertPermission('coupons');
  const code = (formData.get('code') as string).trim().toUpperCase();
  const type = formData.get('type') as 'percent' | 'fixed';
  const value = Number(formData.get('value'));
  const min_order = Number(formData.get('min_order') ?? 0);
  const max_uses = formData.get('max_uses') ? Number(formData.get('max_uses')) : null;
  const expires_at = (formData.get('expires_at') as string) || null;

  if (!code || !type || !value) return;
  if (!/^[A-Z0-9_-]+$/.test(code)) return;
  if (value <= 0) return;

  // coupons RLS bars anon write/read after migration 070; admin
  // mutations must go through the service role.
  const { data: created } = await supabaseAdmin()
    .from('coupons')
    .insert({ code, type, value, min_order, max_uses, expires_at })
    .select('id')
    .single();
  void logAudit(session, {
    action: 'coupon.create', entity: 'coupons', entity_id: created?.id ?? null,
    diff: { code, type, value, min_order, max_uses, expires_at },
  });
  revalidatePath('/admin/coupons');
}

export async function updateCoupon(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await assertPermission('coupons');
  const id = formData.get('id') as string;
  const code = (formData.get('code') as string).trim().toUpperCase();
  const type = formData.get('type') as 'percent' | 'fixed';
  const value = Number(formData.get('value'));
  const min_order = Number(formData.get('min_order') ?? 0);
  const max_uses = formData.get('max_uses') ? Number(formData.get('max_uses')) : null;
  const expires_at = (formData.get('expires_at') as string) || null;

  if (!id) return { error: 'Missing coupon id.' };
  if (!code || !type || !value) return { error: 'Code, type and value are required.' };
  if (!/^[A-Z0-9_-]+$/.test(code)) return { error: 'Code may only contain letters, numbers, - and _.' };
  if (value <= 0) return { error: 'Value must be greater than zero.' };
  if (type === 'percent' && value > 100) return { error: 'A percentage discount cannot exceed 100%.' };

  const { error } = await supabaseAdmin()
    .from('coupons')
    .update({ code, type, value, min_order, max_uses, expires_at })
    .eq('id', id);
  if (error) return { error: error.message };

  void logAudit(session, {
    action: 'coupon.update', entity: 'coupons', entity_id: id,
    diff: { code, type, value, min_order, max_uses, expires_at },
  });
  revalidatePath('/admin/coupons');
  return { ok: true };
}

export async function deleteCoupon(formData: FormData) {
  const session = await assertPermission('coupons');
  const id = formData.get('id') as string;
  const { data: target } = await supabaseAdmin().from('coupons').select('code').eq('id', id).single();
  await supabaseAdmin().from('coupons').delete().eq('id', id);
  void logAudit(session, {
    action: 'coupon.delete', entity: 'coupons', entity_id: id,
    diff: { code: target?.code },
  });
  revalidatePath('/admin/coupons');
}

export async function toggleCoupon(id: string, active: boolean) {
  const session = await assertPermission('coupons');
  await supabaseAdmin().from('coupons').update({ active }).eq('id', id);
  void logAudit(session, {
    action: active ? 'coupon.activate' : 'coupon.deactivate',
    entity: 'coupons', entity_id: id,
  });
  revalidatePath('/admin/coupons');
}
