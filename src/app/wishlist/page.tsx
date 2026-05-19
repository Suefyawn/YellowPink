import { WishlistPage } from '@/sections/wishlist/WishlistPage';

// Personal page — must never be indexed.
export const metadata = {
  title: 'Wishlist — Yellow Pink',
  description: 'Items you have saved for later.',
  robots: { index: false, follow: false },
  alternates: { canonical: 'https://yellowpink.pk/wishlist' },
};

export default function Page() {
  return <WishlistPage />;
}
