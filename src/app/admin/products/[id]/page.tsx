import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ProductForm } from '@/components/admin/ProductForm';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: product } = await supabase.from('products').select('*').eq('id', id).single();
  if (!product) notFound();
  return <ProductForm product={product} />;
}
