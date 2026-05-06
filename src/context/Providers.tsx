'use client';

import { CartProvider } from './CartContext';
import { SearchProvider } from './SearchContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <SearchProvider>
        {children}
      </SearchProvider>
    </CartProvider>
  );
}
