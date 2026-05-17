'use server';

import { revalidatePath } from 'next/cache';
import { headers, cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { reviewLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { reviewSchema, parseForm, firstError } from '@/lib/validators';

// Find a Supabase auth cookie regardless of the project ref in its name.
// Supabase v2 names the session cookie sb-<projectRef>-auth-token.
function findSupabaseAuthCookie(all: { name: string; value: string }[]): string | null {
  const c = all.find(c => /^sb-.+-auth-token$/.test(c.name));
  return c?.value ?? null;
}

export async function submitReview(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  // Rate-limit by IP — anyone (signed in or not) can be limited.
  const h = await headers();
  const { success: rateOk } = await reviewLimiter.limit(ipFromHeaders(h));
  if (!rateOk) return { error: 'Please slow down — try again in a minute.' };

  const parsed = parseForm(reviewSchema, formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  // Best-effort: attribute to the signed-in user if we can resolve the token.
  let userId: string | null = null;
  try {
    const cookieStore = await cookies();
    const token = findSupabaseAuthCookie(cookieStore.getAll());
    if (token) {
      // The cookie value is a JSON-encoded session blob; extract access_token.
      let accessToken: string | undefined;
      try {
        const parsedCookie = JSON.parse(token);
        accessToken = parsedCookie?.access_token;
      } catch { /* not JSON, ignore */ }

      if (accessToken) {
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data } = await adminClient.auth.getUser(accessToken);
        userId = data.user?.id ?? null;
      }
    }
  } catch {
    // non-fatal
  }

  const { error } = await supabase.from('product_reviews').insert({
    product_id:  parsed.data.product_id,
    user_id:     userId,
    author_name: parsed.data.author_name,
    rating:      parsed.data.rating,
    body:        parsed.data.body,
    approved:    false,
  });
  if (error) return { error: error.message };

  revalidatePath(`/product`);
  return { success: true };
}
