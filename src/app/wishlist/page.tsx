import { WishlistPage } from '@/sections/wishlist/WishlistPage';
import { absoluteUrl } from '@/lib/seo';

// Personal page, must never be indexed.
export const metadata = {
  // Bare "Wishlist", the root title.template appends " | Yellow Pink".
  title: 'Wishlist',
  description: 'Items you have saved for later.',
  robots: { index: false, follow: false },
  // Canonical via absoluteUrl so it tracks SITE_URL (www) instead of a
  // hard-coded apex host.
  alternates: { canonical: absoluteUrl('/wishlist') },
};

export default function Page() {
  return <WishlistPage />;
}
