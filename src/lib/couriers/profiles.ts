// ============================================================================
// Client-safe courier profiles: display name + public tracking-URL builder.
//
// Kept separate from index.ts so client components (/track, the admin booking
// form) can import the tracking-URL helper WITHOUT pulling the API adapters
// (tcs.ts et al., which reference server-only env) into the browser bundle.
// index.ts re-exports these for server callers.
// ============================================================================

export interface CourierProfile {
  id: string;
  name: string;
  trackingUrl: (n: string) => string;
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
    name: 'Other / Manual',
    trackingUrl: (n) => `https://www.google.com/search?q=track+${encodeURIComponent(n)}`,
  },
};

export const COURIER_LIST = Object.values(COURIERS);

/** Public tracking deep-link for a courier + consignment number, or null when
 *  the courier isn't recognised. Tolerant of free-text courier values (e.g.
 *  "TCS Express") by substring-matching a known profile id. */
export function courierTrackingUrl(courier: string | null | undefined, tracking: string): string | null {
  if (!courier) return null;
  const profile = COURIERS[courier]
    ?? Object.values(COURIERS).find(p => courier.toLowerCase().includes(p.id.toLowerCase()));
  return profile ? profile.trackingUrl(tracking) : null;
}
