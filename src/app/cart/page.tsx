import { CartPage } from '@/sections/cart/CartPage';
import { getBestsellers } from '@/lib/supabase';

// User-scoped state; noindex.
// Title intentionally just "Cart" — the root layout's title.template
// adds " | Yellow Pink", so spelling out the brand here gave the doubled
// "Cart — Yellow Pink | Yellow Pink" the audit flagged.
export const metadata = {
  title: 'Cart',
  description: 'Review the items in your bag before checkout.',
  robots: { index: false, follow: false },
};

export default async function CartRoute({ searchParams }: { searchParams: Promise<{ restore?: string }> }) {
  const { restore } = await searchParams;
  // Bestsellers feed the "You may also like" cross-sell on the cart. We
  // over-fetch (8) so CartPage can drop whatever's already in the bag and
  // still have a full 4-up row to show.
  const recommended = await getBestsellers(8);
  return (
    <main className="fade-in">
      <CartPage restoreToken={restore ?? null} recommended={recommended} />
    </main>
  );
}
