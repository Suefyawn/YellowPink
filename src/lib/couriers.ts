// ============================================================================
// Pakistan courier registry + adapter shims.
//
// Real label-printing / pickup-booking integrations require merchant
// accounts with each courier. Until those are wired up, the storefront
// supports the manual-tracking-number workflow and the /track page
// already deep-links to each courier's public tracker (see
// src/app/track/page.tsx — courierTrackingUrl).
//
// Add new couriers here by extending COURIERS. When you obtain API
// credentials, fill in the .label() / .book() functions and the
// /api/couriers/*/webhook routes (one per courier) can ingest status
// updates into shipment_events.
// ============================================================================

export interface CourierProfile {
  id: string;
  name: string;
  trackingUrl: (n: string) => string;
  /** Build label PDF (returns URL). Stub for now — real impl per merchant. */
  label?: (args: { trackingNumber: string; orderNumber: string }) => Promise<string | null>;
  /** Book a pickup. Stub for now. */
  book?: (args: { orderId: string; weightGrams?: number }) => Promise<{ trackingNumber: string } | null>;
}

export const COURIERS: Record<string, CourierProfile> = {
  TCS: {
    id: 'TCS',
    name: 'TCS',
    trackingUrl: (n) => `https://www.tcsexpress.com/track/${encodeURIComponent(n)}`,
  },
  Leopards: {
    id: 'Leopards',
    name: 'Leopards Courier',
    trackingUrl: (n) => `https://www.leopardscourier.com/leopards/tracking?tracking_number=${encodeURIComponent(n)}`,
  },
  'M&P': {
    id: 'M&P',
    name: 'M&P',
    trackingUrl: (n) => `https://www.mulphilog.com/tracking?cnno=${encodeURIComponent(n)}`,
  },
  BlueEx: {
    id: 'BlueEx',
    name: 'BlueEx',
    trackingUrl: (n) => `https://www.blue-ex.com/tracking/${encodeURIComponent(n)}`,
  },
  Other: {
    id: 'Other',
    name: 'Other',
    trackingUrl: (n) => `https://www.google.com/search?q=track+${encodeURIComponent(n)}`,
  },
};

export const COURIER_LIST = Object.values(COURIERS);

export function courierTrackingUrl(courier: string | null | undefined, tracking: string): string | null {
  if (!courier) return null;
  const profile = COURIERS[courier] ?? Object.values(COURIERS).find(p => courier.toLowerCase().includes(p.id.toLowerCase()));
  return profile ? profile.trackingUrl(tracking) : null;
}

// Webhook status-mapping. Most PK couriers POST something like
// { trackingNumber, status: 'IN_TRANSIT' | 'DELIVERED' | ... }. We map any
// vaguely-recognisable status to our enum so we don't lose updates from
// couriers whose conventions differ.
export function normaliseCourierStatus(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('deliver'))                       return 'delivered';
  if (s.includes('out for delivery') || s.includes('ofd')) return 'out_for_delivery';
  if (s.includes('transit') || s.includes('shipped') || s.includes('arrived')) return 'in_transit';
  if (s.includes('pick'))                          return 'picked_up';
  if (s.includes('return'))                        return 'returned';
  if (s.includes('cancel'))                        return 'cancelled';
  if (s.includes('fail') || s.includes('refus'))   return 'failed';
  return 'in_transit';
}
