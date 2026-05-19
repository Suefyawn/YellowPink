'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { addressSchema, parseForm, firstError } from '@/lib/validators';

// We need an authenticated Supabase client to leverage RLS on `addresses`
// (each row is gated on auth.uid() = user_id). The Supabase JS auth cookies
// are stored in the browser; on the server we have to reconstruct them.
async function authedClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const store = await cookies();
  // Supabase v2 stores the session in cookies named sb-<ref>-auth-token.
  const sessionCookie = store.getAll().find(c => /^sb-.+-auth-token$/.test(c.name));
  if (sessionCookie) {
    try {
      const parsed = JSON.parse(sessionCookie.value);
      const access  = parsed?.access_token;
      const refresh = parsed?.refresh_token;
      if (access && refresh) {
        await sb.auth.setSession({ access_token: access, refresh_token: refresh });
      }
    } catch { /* malformed cookie — fall through, RLS will reject writes */ }
  }
  return sb;
}

export type AddressActionResult = { error: string } | { success: true } | null;

export async function createAddress(
  _prev: AddressActionResult,
  formData: FormData
): Promise<AddressActionResult> {
  // Normalise the checkbox.
  const normalized = new FormData();
  for (const [k, v] of formData.entries()) normalized.append(k, v);
  normalized.set('is_default', formData.get('is_default') === 'on' ? 'true' : 'false');

  const parsed = parseForm(addressSchema, normalized);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const sb = await authedClient();
  const { data: user } = await sb.auth.getUser();
  if (!user.user) return { error: 'You must be signed in' };

  // If this address is the new default, clear the prior default first.
  if (parsed.data.is_default) {
    await sb.from('addresses').update({ is_default: false }).eq('user_id', user.user.id).eq('is_default', true);
  }

  const { error } = await sb.from('addresses').insert({ ...parsed.data, user_id: user.user.id });
  if (error) return { error: error.message };

  revalidatePath('/account/addresses');
  return { success: true };
}

export async function updateAddress(
  id: string,
  _prev: AddressActionResult,
  formData: FormData
): Promise<AddressActionResult> {
  const normalized = new FormData();
  for (const [k, v] of formData.entries()) normalized.append(k, v);
  normalized.set('is_default', formData.get('is_default') === 'on' ? 'true' : 'false');

  const parsed = parseForm(addressSchema, normalized);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const sb = await authedClient();
  const { data: user } = await sb.auth.getUser();
  if (!user.user) return { error: 'You must be signed in' };

  if (parsed.data.is_default) {
    await sb.from('addresses').update({ is_default: false }).eq('user_id', user.user.id).eq('is_default', true).neq('id', id);
  }

  const { error } = await sb.from('addresses').update(parsed.data).eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/account/addresses');
  return { success: true };
}

export async function deleteAddress(formData: FormData): Promise<{ error?: string } | void> {
  const id = formData.get('id');
  if (typeof id !== 'string') return;
  const sb = await authedClient();
  const { error } = await sb.from('addresses').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/account/addresses');
}

// Flip the `is_default` flag on one address — clearing the previous default
// first so the user always has exactly one. If the clear+set isn't atomic
// in two updates, the second-half failure can leave zero defaults — so we
// SET the new default FIRST, then clear all others except the new one.
// Worst-case interruption now leaves two defaults briefly, never zero.
export async function setDefaultAddress(formData: FormData): Promise<{ error?: string } | void> {
  const id = formData.get('id');
  if (typeof id !== 'string') return;
  const sb = await authedClient();
  const { data: user } = await sb.auth.getUser();
  if (!user.user) return { error: 'Not signed in.' };

  // Set the new default first.
  const { error: setErr } = await sb
    .from('addresses').update({ is_default: true } as never)
    .eq('id', id).eq('user_id', user.user.id);
  if (setErr) return { error: setErr.message };
  // Then clear every other default for this user.
  const { error: clrErr } = await sb
    .from('addresses').update({ is_default: false } as never)
    .eq('user_id', user.user.id).eq('is_default', true).neq('id', id);
  if (clrErr) return { error: clrErr.message };
  revalidatePath('/account/addresses');
}
