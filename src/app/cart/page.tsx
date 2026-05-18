import { CartPage } from '@/sections/cart/CartPage';

export default async function CartRoute({ searchParams }: { searchParams: Promise<{ restore?: string }> }) {
  const { restore } = await searchParams;
  return (
    <main className="fade-in">
      <CartPage restoreToken={restore ?? null} />
    </main>
  );
}
