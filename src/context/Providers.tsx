'use client';

import { CartProvider } from './CartContext';
import { SearchProvider } from './SearchContext';
import { AuthProvider } from './AuthContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <SearchProvider>
          {children}
        </SearchProvider>
      </CartProvider>
    </AuthProvider>
  );
}
