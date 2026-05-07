'use client';

import { CartProvider } from './CartContext';
import { SearchProvider } from './SearchContext';
import { AuthProvider } from './AuthContext';
import { WishlistProvider } from './WishlistContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <SearchProvider>
            {children}
          </SearchProvider>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}
