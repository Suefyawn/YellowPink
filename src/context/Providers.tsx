'use client';

import { CartProvider } from './CartContext';
import { SearchProvider } from './SearchContext';
import { AuthProvider } from './AuthContext';
import { WishlistProvider } from './WishlistContext';
import { CommerceSettingsProvider } from './CommerceSettings';
import { PHProvider } from '@/components/analytics/PostHogProvider';
import { DEFAULT_COMMERCE_CONFIG, type CommerceConfig } from '@/lib/commerce';

export function Providers({
  children,
  commerce = DEFAULT_COMMERCE_CONFIG,
}: {
  children: React.ReactNode;
  commerce?: CommerceConfig;
}) {
  return (
    <PHProvider>
      <CommerceSettingsProvider value={commerce}>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <SearchProvider>
                {children}
              </SearchProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </CommerceSettingsProvider>
    </PHProvider>
  );
}
