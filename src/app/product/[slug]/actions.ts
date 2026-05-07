'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function submitReview(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const productId = formData.get('product_id') as string;
  const authorName = (formData.get('author_name') as string)?.trim();
  const rating = parseInt(formData.get('rating') as string, 10);
  const body = (formData.get('body') as string)?.trim();

  if (!authorName) return { error: 'Please enter your name.' };
  if (!body || body.length < 10) return { error: 'Review must be at least 10 characters.' };
  if (!rating || rating < 1 || rating > 5) return { error: 'Please select a rating.' };
  if (!productId) return { error: 'Invalid product.' };

  // Get auth user id if logged in (optional)
  let userId: string | null = null;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sb-access-token')?.value;
    if (token) {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data } = await adminClient.auth.getUser(token);
      userId = data.user?.id ?? null;
    }
  } catch {
    // non-fatal
  }

  const { error } = await supabase.from('product_reviews').insert({
    product_id: productId,
    user_id: userId,
    author_name: authorName,
    rating,
    body,
    approved: false,
  });

  if (error) return { error: error.message };

  revalidatePath(`/product`);
  return { success: true };
}
