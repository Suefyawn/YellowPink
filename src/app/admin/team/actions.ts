'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { getStaffSession, hashPassword, generateSalt, generateTempPassword } from '@/lib/staff-auth';
import type { Permission } from '@/lib/permissions';

async function assertOwner() {
  const session = await getStaffSession();
  if (!session?.isOwner) throw new Error('Unauthorized');
}

export async function createStaffMember(
  _prev: { error?: string; tempPassword?: string } | null,
  formData: FormData
): Promise<{ error: string } | { tempPassword: string }> {
  await assertOwner();

  const email = (formData.get('email') as string).trim().toLowerCase();
  const name = (formData.get('name') as string).trim();
  const permissions = (formData.getAll('permissions') as Permission[]);

  if (!email || !name) return { error: 'Name and email are required' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Invalid email address' };

  const tempPassword = generateTempPassword();
  const salt = generateSalt();
  const hash = hashPassword(tempPassword, salt);

  const { error } = await supabase.from('staff_members').insert({
    email, name,
    permissions,
    password_hash: hash,
    password_salt: salt,
    is_active: true,
  });

  if (error) {
    if (error.code === '23505') return { error: 'A staff member with this email already exists' };
    return { error: error.message };
  }

  revalidatePath('/admin/team');
  return { tempPassword };
}

export async function updateStaffPermissions(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  await assertOwner();

  const id = formData.get('id') as string;
  const name = (formData.get('name') as string).trim();
  const permissions = (formData.getAll('permissions') as Permission[]);

  const { error } = await supabase
    .from('staff_members')
    .update({ name, permissions })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/admin/team');
  return null;
}

export async function toggleStaffActive(formData: FormData): Promise<void> {
  await assertOwner();

  const id = formData.get('id') as string;
  const isActive = formData.get('is_active') === 'true';

  await supabase
    .from('staff_members')
    .update({ is_active: !isActive })
    .eq('id', id);

  revalidatePath('/admin/team');
}

export async function resetStaffPassword(
  _prev: { error?: string; tempPassword?: string } | null,
  formData: FormData
): Promise<{ error: string } | { tempPassword: string }> {
  await assertOwner();

  const id = formData.get('id') as string;
  const tempPassword = generateTempPassword();
  const salt = generateSalt();
  const hash = hashPassword(tempPassword, salt);

  const { error } = await supabase
    .from('staff_members')
    .update({ password_hash: hash, password_salt: salt })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/admin/team');
  return { tempPassword };
}

export async function deleteStaffMember(formData: FormData): Promise<void> {
  await assertOwner();

  const id = formData.get('id') as string;
  await supabase.from('staff_members').delete().eq('id', id);
  revalidatePath('/admin/team');
}

// Used by staff profile page
export async function changeMyPassword(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const session = await getStaffSession();
  if (!session || session.isOwner) return { error: 'Unauthorized' };

  const current = formData.get('current_password') as string;
  const next = formData.get('new_password') as string;
  const confirm = formData.get('confirm_password') as string;

  if (!current || !next) return { error: 'All fields are required' };
  if (next.length < 8) return { error: 'New password must be at least 8 characters' };
  if (next !== confirm) return { error: 'Passwords do not match' };

  const { data } = await supabase
    .from('staff_members')
    .select('password_hash, password_salt')
    .eq('id', session.id)
    .single();

  if (!data) return { error: 'Account not found' };

  const currentHash = hashPassword(current, data.password_salt);
  if (currentHash !== data.password_hash) return { error: 'Current password is incorrect' };

  const salt = generateSalt();
  const hash = hashPassword(next, salt);

  const { error } = await supabase
    .from('staff_members')
    .update({ password_hash: hash, password_salt: salt })
    .eq('id', session.id);

  if (error) return { error: error.message };
  return { success: true };
}
