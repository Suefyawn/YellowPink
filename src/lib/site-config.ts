// ============================================================================
// Site settings cache. Phase 1.6.
//
// Reads site_settings into an in-process cache (60s TTL). Use this instead of
// hitting Supabase on every request. Mutations (admin settings page) call
// `bustSiteSettings()` to invalidate.
// ============================================================================

import { supabase } from './supabase';

interface SettingsCache {
  data: Record<string, string>;
  expiresAt: number;
}

let cache: SettingsCache | null = null;
const TTL_MS = 60_000;

export async function siteSettings(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.data;

  const { data } = await supabase.from('site_settings').select('key, value');
  const map = Object.fromEntries(
    (data ?? []).map((r: { key: string; value: string }) => [r.key, r.value])
  );
  cache = { data: map, expiresAt: now + TTL_MS };
  return map;
}

export function bustSiteSettings(): void {
  cache = null;
}

// Strongly-typed accessors with sane defaults.
export async function siteSettingsTyped(): Promise<{
  storeName: string;
  storeEmail: string;
  storePhone: string;
  currency: string;
  freeShippingThreshold: number;
  defaultShippingRate: number;
  taxRatePercent: number;
  taxInclusive: boolean;
}> {
  const s = await siteSettings();
  return {
    storeName:             s.store_name ?? 'Yellow Pink',
    storeEmail:            s.store_email ?? 'hello@yellowpink.pk',
    storePhone:            s.store_phone ?? '',
    currency:              s.currency ?? 'PKR',
    freeShippingThreshold: Number(s.free_shipping_threshold ?? 2500),
    defaultShippingRate:   Number(s.default_shipping_rate ?? 200),
    taxRatePercent:        Number(s.tax_rate_percent ?? 0),
    taxInclusive:          s.tax_inclusive === 'true',
  };
}
