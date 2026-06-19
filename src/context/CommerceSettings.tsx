'use client';

// Makes the owner's free-shipping / shipping configuration available to client
// storefront components (cart, mini-cart, PDP, checkout) so their copy and
// progress bars track the live setting instead of a hard-coded constant. The
// server layout reads site_settings once per request and seeds this provider;
// the authoritative rate at checkout still comes from the server resolver.

import { createContext, useContext } from 'react';
import { DEFAULT_COMMERCE_CONFIG, type CommerceConfig } from '@/lib/commerce';

const CommerceSettingsContext = createContext<CommerceConfig>(DEFAULT_COMMERCE_CONFIG);

export function CommerceSettingsProvider({
  value,
  children,
}: {
  value: CommerceConfig;
  children: React.ReactNode;
}) {
  return (
    <CommerceSettingsContext.Provider value={value}>
      {children}
    </CommerceSettingsContext.Provider>
  );
}

export function useCommerceSettings(): CommerceConfig {
  return useContext(CommerceSettingsContext);
}
