import { ProductForm } from '@/components/admin/ProductForm';
import { supabaseAdmin } from '@/lib/supabase';
import type { Vendor } from '@/types';

export default async function NewProductPage() {
  // vendors RLS has no policy — read with the service role.
  const { data } = await supabaseAdmin().from('vendors').select('*').order('name');
  return <ProductForm vendors={(data ?? []) as Vendor[]} />;
}
