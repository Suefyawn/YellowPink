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

export function FreeShippingProgress({ subtotal }: { subtotal: number }) {
  const { freeShippingEnabled, freeShippingThreshold } = useCommerceSettings();
  if (!freeShippingEnabled || freeShippingThreshold <= 0 || subtotal <= 0) return null;

  const remaining = Math.max(0, freeShippingThreshold - subtotal);
  const pct = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));
  const unlocked = remaining === 0;

  return (
    <div aria-live="polite">
      <div className="small-text" style={{ marginBottom: 6, color: unlocked ? '#15803d' : 'var(--ink-700)', fontWeight: unlocked ? 600 : 400 }}>
        {unlocked
          ? 'You’ve unlocked FREE delivery on this order'
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
    </div>
  );
}
