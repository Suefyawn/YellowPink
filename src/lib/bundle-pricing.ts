// ============================================================================
// Bundle pricing math + the vendor explainer message.
//
// A bundle's economics: the customer pays the bundle price; we owe the vendor
// the per-component vendor cost. The saving we advertise is against the sum
// of the components' individual retail prices. All three surfaces (admin
// pricing panel, PDP "What's inside", vendor WhatsApp messages) compute from
// the same rows so they can never disagree.
//
// Cost resolution, in order:
//   1. an explicit cost on the product (cost_price, else vendor_cost);
//   2. derived from the vendor's commission terms — on a straight-commission
//      arrangement (e.g. NB Sons: we keep 35%) the effective cost is
//      retail × (1 − commission%), no per-product data entry needed;
//   3. otherwise unknown.
//
// Guardrail philosophy: the honest answer is "unverifiable", never a
// silently-wrong margin. Margin is only claimed when every component's cost
// resolves, and commission-derived costs are labeled as such.
// ============================================================================

import type { Product } from '@/types';

export interface BundleComponentRow {
  product: Product;
  qty: number;
}

/** vendor_id → the % of retail we keep on that vendor's sales. */
export type CommissionByVendor = Record<string, number>;

export interface ComponentCost {
  cost: number | null;
  source: 'explicit' | 'commission' | null;
}

export interface BundleEconomics {
  /** Sum of components' individual retail prices × qty. */
  individualTotal: number;
  /** individualTotal − bundle price (what the customer saves). */
  saving: number;
  savingPct: number;
  /** Sum of vendor costs × qty, or null when any component's cost is unknown. */
  costTotal: number | null;
  /** bundle price − costTotal, or null when costs are incomplete. */
  margin: number | null;
  marginPct: number | null;
  /** Component names with no resolvable cost — the guardrail's blocker list. */
  missingCosts: string[];
  /** Component names whose cost came from vendor commission terms, not an
   *  explicitly entered cost price. */
  derivedCosts: string[];
}

/** A component's vendor cost and where it came from. */
export function componentUnitCost(p: Product, commissionByVendor?: CommissionByVendor): ComponentCost {
  const explicit = p.cost_price ?? p.vendor_cost;
  if (typeof explicit === 'number' && explicit > 0) return { cost: explicit, source: 'explicit' };
  const pct = p.vendor_id ? commissionByVendor?.[p.vendor_id] : undefined;
  if (typeof pct === 'number' && pct > 0 && pct < 100) {
    return { cost: p.price * (1 - pct / 100), source: 'commission' };
  }
  return { cost: null, source: null };
}

export function bundleEconomics(
  bundlePrice: number,
  components: BundleComponentRow[],
  commissionByVendor?: CommissionByVendor,
): BundleEconomics {
  const individualTotal = components.reduce((s, c) => s + c.product.price * c.qty, 0);
  const saving = individualTotal - bundlePrice;
  const costs = components.map(c => ({ c, ...componentUnitCost(c.product, commissionByVendor) }));
  const missingCosts = costs.filter(x => x.cost == null).map(x => x.c.product.name);
  const derivedCosts = costs.filter(x => x.source === 'commission').map(x => x.c.product.name);
  const costTotal = missingCosts.length === 0
    ? costs.reduce((s, x) => s + (x.cost ?? 0) * x.c.qty, 0)
    : null;
  const margin = costTotal == null ? null : bundlePrice - costTotal;
  return {
    individualTotal,
    saving,
    savingPct: individualTotal > 0 ? (saving / individualTotal) * 100 : 0,
    costTotal,
    margin,
    marginPct: margin != null && bundlePrice > 0 ? (margin / bundlePrice) * 100 : null,
    missingCosts,
    derivedCosts,
  };
}

/** Margin floor below which the admin panel warns. */
export const BUNDLE_MARGIN_FLOOR_PCT = 15;

/** The message the owner sends the vendor when introducing a bundle, so the
 *  arrangement is stated plainly: we sell THEIR individual products together
 *  at OUR discounted set price; their per-item billing is unchanged, and
 *  every order will list the components separately for packing. */
export function buildVendorBundleExplainer(opts: {
  bundleName: string;
  bundlePrice: number;
  components: BundleComponentRow[];
}): string {
  return [
    `Assalam-o-Alaikum! Yellow Pink se.`,
    '',
    `Hum aap ke kuch individual products ko apni website par ek set ke tor par bech rahe hain:`,
    '',
    `"${opts.bundleName}" (hamari website ki set price: PKR ${Math.round(opts.bundlePrice).toLocaleString()})`,
    '',
    `Is set mein aap ke ye products shamil hain:`,
    ...opts.components.map(c => `• ${c.qty}× ${c.product.name}`),
    '',
    `Wazahat ke liye:`,
    `• Ye aap ke apne individual products hain jo hum ek sath bech rahe hain. Set ka discount hamari taraf se hai.`,
    `• Aap ki billing har item ke maujooda vendor rate par hi hogi, koi tabdeeli nahi.`,
    `• Jab is set ka order aaye ga, hum aap ko har product alag se likh kar bhejenge taake packing mein asani ho.`,
    '',
    `Koi sawal ho to zaroor poochein. Shukriya!`,
  ].join('\n');
}
