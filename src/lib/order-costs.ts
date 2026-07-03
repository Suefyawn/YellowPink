// Shared order-cost engine — "the order's vendor determines its cost".
//
// One rule, applied everywhere an order's goods (acquisition) cost is needed:
// vendor dispatch (vendor_settlements + auto acquisition_cost), manual order
// creation, and the order page's "Recalculate from vendor rate" action all
// call resolveOrderCosts so the settlement figure and the auto-filled
// acquisition cost are the same number by construction.
//
// Per-item unit-cost basis, in priority order:
//   1. `vendor_cost`  — the product's explicit fixed per-unit PKR cost.
//   2. `commission`   — the vendor's commission % (the % of the sale price
//                       the STORE keeps): unit cost = price × (1 − pct/100).
//   3. `cost_price`   — the product's own-stock acquisition cost.
//   4. `unknown`      — no basis at all → cost 0, and the line is counted in
//                       `unknownCount` so callers can flag the gap.

export interface CostItem {
  /** Product id (order items JSONB carries the snapshot at purchase time). */
  id?: string | null;
  name?: string | null;
  qty?: number | null;
  price?: number | null;
}

export interface CostVendor {
  id: string;
  /** Used only for the human basisLabel; safe to omit. */
  name?: string | null;
  /** % of the sale price the store keeps on this vendor's products. */
  commission_pct: number | null;
}

export interface CostProductInfo {
  /** Fixed per-unit PKR cost agreed with the vendor; overrides the %. */
  vendor_cost?: number | null;
  /** Own-stock acquisition cost per unit. */
  cost_price?: number | null;
}

export type CostBasis = 'vendor_cost' | 'commission' | 'cost_price' | 'unknown';

export interface OrderCostLine {
  id: string | null;
  name: string;
  qty: number;
  unitCost: number;
  basis: CostBasis;
}

export interface OrderCostResult {
  /** Total goods cost for the order, rounded to 2 dp. */
  totalCost: number;
  lines: OrderCostLine[];
  /** Number of lines that had no cost basis at all (costed at 0). */
  unknownCount: number;
  /** Human summary of where the cost came from, e.g.
   *  "NB Sons @ 12.5% margin" or "per-product costs". */
  basisLabel: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** "12.50" → "12.5", "18.00" → "18" — for human-facing % labels. */
function fmtPct(pct: number): string {
  return String(Number(pct));
}

export function resolveOrderCosts(
  items: CostItem[],
  vendor: CostVendor | null,
  productsById: Map<string, CostProductInfo>,
): OrderCostResult {
  const commission = vendor?.commission_pct ?? null;
  const lines: OrderCostLine[] = [];
  let totalCost = 0;
  let unknownCount = 0;

  for (const item of items ?? []) {
    const qty = Math.max(0, Number(item?.qty) || 0);
    const price = Math.max(0, Number(item?.price) || 0);
    const prod = item?.id ? productsById.get(item.id) : undefined;

    let basis: CostBasis;
    let unitCost: number;
    if (prod?.vendor_cost != null) {
      basis = 'vendor_cost';
      unitCost = Number(prod.vendor_cost);
    } else if (vendor && commission != null) {
      basis = 'commission';
      unitCost = price * (1 - commission / 100);
    } else if (prod?.cost_price != null) {
      basis = 'cost_price';
      unitCost = Number(prod.cost_price);
    } else {
      basis = 'unknown';
      unitCost = 0;
      unknownCount += 1;
    }

    unitCost = round2(Math.max(0, unitCost));
    totalCost += unitCost * qty;
    lines.push({
      id: item?.id ?? null,
      name: item?.name ?? '',
      qty,
      unitCost,
      basis,
    });
  }

  totalCost = round2(totalCost);

  // Human label: where did this number come from?
  const costed = lines.filter(l => l.basis !== 'unknown');
  const hasCommission = costed.some(l => l.basis === 'commission');
  const hasPerProduct = costed.some(l => l.basis !== 'commission');
  const commissionLabel =
    vendor && commission != null
      ? `${vendor.name?.trim() || 'vendor'} @ ${fmtPct(commission)}% margin`
      : 'vendor rate';
  let basisLabel: string;
  if (costed.length === 0) basisLabel = 'unknown';
  else if (hasCommission && !hasPerProduct) basisLabel = commissionLabel;
  else if (!hasCommission) basisLabel = 'per-product costs';
  else basisLabel = `${commissionLabel} + per-product costs`;

  return { totalCost, lines, unknownCount, basisLabel };
}
