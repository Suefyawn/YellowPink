// ============================================================================
// Bundle pricing math + the vendor explainer message.
//
// A bundle's economics: the customer pays the bundle price; we owe the vendor
// the per-component vendor cost. The saving we advertise is against the sum
// of the components' individual retail prices. All three surfaces (admin
// pricing panel, PDP "What's inside", vendor WhatsApp messages) compute from
// the same rows so they can never disagree.
//
// Guardrail philosophy: with vendor costs missing on most of the catalogue,
// the honest answer is "unverifiable", never a silently-wrong margin. The
// panel only claims a margin when every component has a cost.
// ============================================================================

import type { Product } from '@/types';

export interface BundleComponentRow {
  product: Product;
  qty: number;
}

export interface BundleEconomics {
  /** Sum of components' individual retail prices × qty. */
  individualTotal: number;
  /** individualTotal − bundle price (what the customer saves). */
  saving: number;
  savingPct: number;
  /** Sum of vendor costs × qty, or null when any component lacks a cost. */
  costTotal: number | null;
  /** bundle price − costTotal, or null when costs are incomplete. */
  margin: number | null;
  marginPct: number | null;
  /** Component names with no cost on file — the guardrail's blocker list. */
  missingCosts: string[];
}

/** A component's vendor cost, or null when none is on file. */
export function componentUnitCost(p: Product): number | null {
  const c = p.cost_price ?? p.vendor_cost;
  return typeof c === 'number' && c > 0 ? c : null;
}

export function bundleEconomics(bundlePrice: number, components: BundleComponentRow[]): BundleEconomics {
  const individualTotal = components.reduce((s, c) => s + c.product.price * c.qty, 0);
  const saving = individualTotal - bundlePrice;
  const missingCosts = components.filter(c => componentUnitCost(c.product) == null).map(c => c.product.name);
  const costTotal = missingCosts.length === 0
    ? components.reduce((s, c) => s + (componentUnitCost(c.product) ?? 0) * c.qty, 0)
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
