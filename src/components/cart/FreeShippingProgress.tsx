'use client';

// Free-delivery progress nudge shared by the mini-cart drawer and the cart
// page. A concrete "Add PKR X more" + fill bar replaces the old vague "your
// exact threshold shows at checkout" copy — the shopper can see exactly how
// close they are, which nudges the add-one-more-item behaviour that lifts
// average order value. Reads the owner's live default threshold via
// CommerceSettings; checkout's server-side zone resolver stays authoritative
// for the actual charge (remote zones can differ, which is why the copy says
// "free delivery" and not a hard promise of the zone rate).
import { useCommerceSettings } from '@/context/CommerceSettings';
import { vendorFreeShippingEligible, cheapestVendorRemaining, type ShippingItem } from '@/lib/vendor-shipping';

export function FreeShippingProgress({ subtotal, items = [] }: { subtotal: number; items?: ShippingItem[] }) {
  const { freeShippingEnabled, freeShippingThreshold, vendorFreeShipThresholds } = useCommerceSettings();

  // Vendor rule (NB Sons ≥ Rs 1,999, migration 770): when one vendor's items
  // alone qualify, delivery is free everywhere — independent of zones and the
  // master switch. Without this the bar told a qualified basket to "add
  // PKR X more" while checkout showed FREE.
  const vendorUnlocked = vendorFreeShippingEligible(items, vendorFreeShipThresholds);

  // The nudge targets the CHEAPEST open unlock (owner report 2026-08-04: a
  // Rs 1,490 NB Sons basket was told "add Rs 3,510" against the storewide
  // threshold when Rs 509 more of NB Sons items already unlocks free
  // delivery). Only shown when the whole cart is that vendor's — in a mixed
  // cart "add X more" would be ambiguous about WHICH products count, so the
  // storewide number stays.
  const vendorPath = cheapestVendorRemaining(items, vendorFreeShipThresholds);
  const genericRemaining = freeShippingEnabled && freeShippingThreshold > 0
    ? Math.max(0, freeShippingThreshold - subtotal)
    : null;
  const useVendorPath = !vendorUnlocked && vendorPath !== null && vendorPath.wholeCart
    && (genericRemaining === null || vendorPath.remaining < genericRemaining);

  if (!vendorUnlocked && !useVendorPath && (!freeShippingEnabled || freeShippingThreshold <= 0)) return null;
  if (subtotal <= 0) return null;

  const remaining = vendorUnlocked ? 0
    : useVendorPath ? vendorPath!.remaining
    : Math.max(0, freeShippingThreshold - subtotal);
  const pct = vendorUnlocked ? 100
    : useVendorPath ? Math.min(100, Math.round((vendorPath!.vendorSum / vendorPath!.threshold) * 100))
    : Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));
  const unlocked = remaining === 0;

  return (
    <div aria-live="polite">
      <div className="small-text" style={{ marginBottom: 6, color: unlocked ? '#15803d' : 'var(--ink-700)', fontWeight: unlocked ? 600 : 400 }}>
        {vendorUnlocked
          ? 'You’ve unlocked FREE delivery'
          : unlocked
            ? 'You’ve unlocked FREE delivery for most regions'
            : <>Add <strong className="tabular-nums">PKR {remaining.toLocaleString()}</strong> more for FREE delivery</>}
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress towards free delivery"
        style={{ height: 6, background: 'var(--line)', borderRadius: 100, overflow: 'hidden' }}
      >
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 100,
          background: unlocked ? '#16a34a' : 'var(--brand-pink-cta)',
          transition: 'width 300ms ease',
        }} />
      </div>
      {/* Delivery is zone-priced (Punjab/Islamabad unlocks lowest; Sindh/KPK
          and remote areas a bit higher). The cart doesn't know the province
          yet, so the bar tracks the standard (lowest, most-traffic) threshold
          and this line keeps the promise honest; checkout shows the exact
          zone figure once the province is picked. The vendor rule is
          nationwide, so no caveat when it's what unlocked the bar. */}
      {!vendorUnlocked && (
        <div style={{ marginTop: 5, fontSize: '0.6875rem', color: 'var(--ink-500)' }}>
          {useVendorPath
            // The vendor rule is nationwide and zone-independent, so the
            // promise is exact — no "farther regions" caveat.
            ? `This brand ships free on orders over PKR ${vendorPath!.threshold.toLocaleString()}, anywhere in Pakistan.`
            : 'Standard threshold — farther regions unlock slightly higher. Exact figure at checkout.'}
        </div>
      )}
    </div>
  );
}
