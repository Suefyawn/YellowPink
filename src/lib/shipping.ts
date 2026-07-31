// ============================================================================
// Shipping rate resolution. Phase 1.5.
//
// Reads shipping_zones / shipping_rates / province_zones from Supabase and
// resolves the rate for a given province + subtotal. Defaults match the
// historical hard-coded `FREE_SHIPPING = 2500 / shipping = 200` behaviour
// so the storefront keeps working even if the tables aren't populated yet.
// ============================================================================

import { supabase, supabaseAdmin, getSiteSettings } from './supabase';
import { parseCommerceConfig, formatPkr } from './commerce';
import { vendorFreeShippingEligible, type ShippingItem } from './vendor-shipping';

// Pure eligibility rule lives in vendor-shipping.ts (client-safe); re-export
// so existing server-side importers keep working.
export { vendorFreeShippingEligible, type ShippingItem };

// The vendors table is RLS-locked to staff, so the threshold lookup runs on
// the admin client (this module is server-only). Thresholds change ~never;
// cache per lambda for 5 minutes to keep the checkout quote to one extra
// query per cold start instead of one per keystroke-triggered re-quote.
let vendorThresholdCache: { value: Record<string, number>; expiresAt: number } | null = null;

/** vendor_id → free-shipping threshold (PKR), for every vendor that has one.
 *  Exported so the layout can seed CommerceSettings and client surfaces (cart
 *  progress bar, checkout's optimistic estimate) can apply the same rule the
 *  server enforces. */
export async function getVendorFreeShipThresholds(): Promise<Record<string, number>> {
  if (vendorThresholdCache && vendorThresholdCache.expiresAt > Date.now()) {
    return vendorThresholdCache.value;
  }
  const map: Record<string, number> = {};
  try {
    const { data } = await supabaseAdmin()
      .from('vendors')
      .select('id, free_shipping_threshold')
      .not('free_shipping_threshold', 'is', null);
    for (const row of data ?? []) {
      const t = Number(row.free_shipping_threshold);
      if (Number.isFinite(t) && t > 0) map[row.id as string] = t;
    }
  } catch {
    // Quote falls back to zone rules; place_order still applies the vendor
    // rule server-side, so a lookup hiccup can only over-quote, never under.
  }
  vendorThresholdCache = { value: map, expiresAt: Date.now() + 5 * 60_000 };
  return map;
}

export interface ResolvedRate {
  rate: number;
  free: boolean;
  label: string;
  estimatedDays?: { min: number; max: number } | null;
}

interface Row {
  rate: number;
  free_shipping_threshold: number | null;
  label: string;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
}

export async function resolveShipping(opts: {
  province?: string;
  subtotal: number;
  /** Cart lines; enables the vendor free-shipping rule (NB Sons ≥ Rs 1,999). */
  items?: ShippingItem[];
}): Promise<ResolvedRate> {
  const { province, subtotal, items } = opts;

  // Vendor rule first: it's independent of zones and the master free-shipping
  // switch (it exists to match the vendor's own store, not as a promotion).
  if (items && items.length > 0) {
    const thresholds = await getVendorFreeShipThresholds();
    if (vendorFreeShippingEligible(items, thresholds)) {
      return { rate: 0, free: true, label: 'Standard' };
    }
  }

  // Owner config: default threshold/rate + the master free-shipping switch.
  // When free shipping is switched off, no order ever qualifies, even if a
  // zone still carries a threshold value.
  const cfg = parseCommerceConfig(await getSiteSettings());
  const DEFAULT_FREE_THRESHOLD = cfg.freeShippingThreshold;
  const DEFAULT_RATE = cfg.defaultShippingRate;

  // Look up zone by province, then the cheapest rate for that zone.
  let zoneId: string | null = null;
  if (province) {
    const { data } = await supabase
      .from('province_zones')
      .select('zone_id')
      .eq('province', province)
      .maybeSingle();
    zoneId = (data?.zone_id as string | undefined) ?? null;
  }

  // Fallback to any active zone if no province match.
  if (!zoneId) {
    const { data } = await supabase
      .from('shipping_zones')
      .select('id')
      .eq('active', true)
      .order('sort_order')
      .limit(1)
      .maybeSingle();
    zoneId = (data?.id as string | undefined) ?? null;
  }

  if (!zoneId) {
    // No zones configured, use the owner's default threshold/rate.
    const free = cfg.freeShippingEnabled && subtotal >= DEFAULT_FREE_THRESHOLD;
    return { rate: free ? 0 : DEFAULT_RATE, free, label: 'Standard' };
  }

  const { data: rateRow } = await supabase
    .from('shipping_rates')
    .select('rate, free_shipping_threshold, label, estimated_days_min, estimated_days_max')
    .eq('zone_id', zoneId)
    .order('rate', { ascending: true })
    .limit(1)
    .maybeSingle();

  const row = (rateRow as Row | null) ?? {
    rate: DEFAULT_RATE,
    free_shipping_threshold: DEFAULT_FREE_THRESHOLD,
    label: 'Standard',
    estimated_days_min: null,
    estimated_days_max: null,
  };

  const free =
    cfg.freeShippingEnabled &&
    row.free_shipping_threshold != null &&
    subtotal >= row.free_shipping_threshold;
  return {
    rate: free ? 0 : row.rate,
    free,
    label: row.label,
    estimatedDays:
      row.estimated_days_min != null && row.estimated_days_max != null
        ? { min: row.estimated_days_min, max: row.estimated_days_max }
        : null,
  };
}

// ─── Live zone table for CMS pages ──────────────────────────────────────────
// The {{shipping_zones}} token on the Shipping / FAQ pages renders this, so the
// published policy always mirrors the real zones/rates and can never drift when
// rates change in admin.
export interface ShippingZoneDisplay {
  label: string;
  rate: number;
  freeOver: number | null;
}

export async function getShippingZonesForDisplay(): Promise<ShippingZoneDisplay[]> {
  const [{ data: zones }, { data: rates }, { data: pz }] = await Promise.all([
    supabase.from('shipping_zones').select('id, name, sort_order').eq('active', true).order('sort_order', { ascending: true }),
    supabase.from('shipping_rates').select('zone_id, rate, free_shipping_threshold'),
    supabase.from('province_zones').select('province, zone_id'),
  ]);
  const rateBy = new Map((rates ?? []).map(r => [r.zone_id as string, r]));
  return ((zones ?? []) as Array<{ id: string; name: string }>).map(z => {
    const provinces = ((pz ?? []) as Array<{ province: string; zone_id: string }>)
      .filter(p => p.zone_id === z.id).map(p => p.province);
    const r = rateBy.get(z.id) as { rate: number; free_shipping_threshold: number | null } | undefined;
    // Prefer the human province list; fall back to the zone name (minus any
    // "Zone N — " prefix) when a zone has no provinces mapped yet.
    const label = provinces.length ? provinces.join(', ') : z.name.replace(/^Zone\s*\d+\s*[—-]\s*/i, '');
    return { label, rate: Number(r?.rate ?? 0), freeOver: r?.free_shipping_threshold ?? null };
  }).filter(z => z.rate > 0);
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

/** HTML table of the live zones for injection into CMS body_html (already
 *  past sanitisation — content is store-controlled). `freeEnabled` mirrors the
 *  master free-shipping switch. Returns '' when no zones so callers can drop
 *  the token cleanly. */
export function shippingZonesHtml(zones: ShippingZoneDisplay[], freeEnabled: boolean): string {
  if (!zones.length) return '';
  const rows = zones.map(z => {
    const free = freeEnabled && z.freeOver ? `Free over ${formatPkr(z.freeOver)}` : '—';
    return `<tr><td>${esc(z.label)}</td><td>${formatPkr(z.rate)}</td><td>${free}</td></tr>`;
  }).join('');
  return (
    `<table style="width:100%;border-collapse:collapse;margin:12px 0">` +
    `<thead><tr>` +
    `<th style="text-align:left;padding:8px;border-bottom:2px solid #eee">Region</th>` +
    `<th style="text-align:left;padding:8px;border-bottom:2px solid #eee">Delivery charge</th>` +
    `<th style="text-align:left;padding:8px;border-bottom:2px solid #eee">Free delivery</th>` +
    `</tr></thead><tbody>${rows}</tbody></table>`
  );
}

/** Pre-address delivery estimate for storefront surfaces (PDP, cart) that
 *  don't yet know the customer's province, resolves the first active zone's
 *  standard ETA. Returns null when no zone configures estimated days, so
 *  callers can simply skip the line rather than show a made-up number. */
export async function getDefaultEstimatedDays(): Promise<{ min: number; max: number } | null> {
  const { estimatedDays } = await resolveShipping({ subtotal: 0 });
  return estimatedDays ?? null;
}
