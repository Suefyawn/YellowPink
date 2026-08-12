// ============================================================================
// Pakistan courier registry + adapter resolver.
//
// Each PK courier has:
//   (a) A CourierProfile, display name + the public tracking-URL builder
//       used by the /track page so customers can deep-link to the courier's
//       site.
//   (b) Optionally, an API-backed CourierAdapter (see types.ts + tcs.ts)
//       that can book + cancel + track via HTTP. Adapters are looked up via
//       getAdapter(id); merchants without API credentials fall back to the
//       manual tracking-number workflow.
//
// To add another courier (Leopards / M&P / BlueEx):
//   1. Create src/lib/couriers/<name>.ts implementing CourierAdapter.
//   2. Import + add to ADAPTERS below.
//   3. Document its required env vars in the file header.
// ============================================================================

import type { CourierAdapter } from './types';
import { tcs, isMisconfiguredForProduction } from './tcs';

// Client-safe display/tracking-URL profiles live in ./profiles so client
// components can import them without bundling the API adapters. Re-exported
// here for the many server callers that already `import … from '@/lib/couriers'`.
export type { CourierProfile } from './profiles';
export { COURIERS, COURIER_LIST, courierTrackingUrl } from './profiles';

// ─── API adapter map ───────────────────────────────────────────────────────
// Only couriers with a real adapter live here. Look up via getAdapter(id);
// returns null if the courier is manual-only or the env isn't configured.
const ADAPTERS: Record<string, CourierAdapter> = {
  TCS: tcs,
};

/**
 * Returns the live API adapter for a courier id, or null if:
 *   - the courier doesn't have an adapter implemented yet, OR
 *   - the adapter's required env vars aren't set in this deployment.
 *
 * Callers should fall back to manual tracking-number entry in either case.
 */
export function getAdapter(courierId: string | null | undefined): CourierAdapter | null {
  if (!courierId) return null;
  const adapter = ADAPTERS[courierId];
  if (!adapter) return null;
  return adapter.isConfigured() ? adapter : null;
}

/** List of courier ids that have a configured + live adapter. UI uses this
 *  to decide whether to show "Book pickup" or "Enter tracking manually".
 *
 *  A courier pointed at its TEST environment in production is deliberately
 *  EXCLUDED: booking there returns a consignment number that never reaches
 *  the courier, so the only safe path is manual entry (see tcs.ts's sandbox
 *  guard and the banner in ShipmentBookingForm). */
export function configuredAdapterIds(): string[] {
  return Object.keys(ADAPTERS).filter(
    id => ADAPTERS[id].isConfigured() && !(id === 'TCS' && isMisconfiguredForProduction()),
  );
}

/** Human-readable reason a configured courier is nonetheless unavailable for
 *  API booking, for the admin UI. Null when everything is fine. */
export function adapterBlockedReason(): string | null {
  if (isMisconfiguredForProduction()) {
    return 'TCS is pointed at its test environment (TCS_BASE_URL), so API booking is disabled to prevent consignment numbers that never reach TCS. Book on the TCS portal and enter the tracking number below. Fix: set TCS_BASE_URL to https://ociconnect.tcscourier.com with production credentials in Vercel, then redeploy.';
  }
  return null;
}

// Re-export the status mapper so the existing webhook route's
// `import { normaliseCourierStatus } from '@/lib/couriers'` keeps working.
export { normaliseCourierStatus } from './status-mapper';
