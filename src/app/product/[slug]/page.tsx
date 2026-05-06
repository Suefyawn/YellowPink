export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getProductBySlug } from '@/lib/supabase';
import { PDPPage } from '@/sections/pdp/PDPPage';

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  return (
    <main className="fade-in">
      <PDPPage product={product} />
    </main>
  );
}
