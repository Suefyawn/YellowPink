// Stock valuation for the Cash page (owner ask, 1 Sep 2026): the cashbook
// says what money is in hand, but the business also OWNS stock — if that
// stock were liquidated, what is it worth? Cash plus stock-at-cost is the
// business's total position.
//
// Only inventory-TRACKED products count: external/dropship listings
// (track_inventory=false, the vendor's stock) are not owned and are excluded.
// For variable products the shade variants' stock is authoritative — the
// parent's counter is an aggregate of the same units and would double-count.

export interface ValuationProduct {
  id: string;
  kind: string | null;
  track_inventory: boolean | null;
  stock: number | null;
  price: number;
  cost_price: number | null;
}

export interface ValuationVariant {
  product_id: string;
  stock: number | null;
  price: number | null;
  enabled: boolean | null;
}

export interface StockValuation {
  /** Physical units the store owns right now. */
  units: number;
  /** What those units cost to buy (only products with a known cost_price). */
  atCost: number;
  /** What they sell for at today's storefront prices. */
  atRetail: number;
  /** Units counted in atRetail but missing a cost_price (their cost isn't in
   *  atCost, so the true cost figure is at least atCost). */
  unitsMissingCost: number;
  productsMissingCost: number;
}

export function computeStockValuation(
  products: ValuationProduct[],
  variants: ValuationVariant[],
): StockValuation {
  const variantsByProduct = new Map<string, ValuationVariant[]>();
  for (const v of variants) {
    if (v.enabled === false) continue;
    (variantsByProduct.get(v.product_id) ?? variantsByProduct.set(v.product_id, []).get(v.product_id)!).push(v);
  }

  const out: StockValuation = { units: 0, atCost: 0, atRetail: 0, unitsMissingCost: 0, productsMissingCost: 0 };

  for (const p of products) {
    if (p.track_inventory === false) continue; // dropship/external: not our stock
    const cost = p.cost_price != null && Number(p.cost_price) > 0 ? Number(p.cost_price) : null;

    let units = 0;
    let retail = 0;
    if (p.kind === 'variable') {
      for (const v of variantsByProduct.get(p.id) ?? []) {
        const s = Math.max(0, Number(v.stock ?? 0));
        if (s === 0) continue;
        units += s;
        retail += s * (Number(v.price ?? 0) > 0 ? Number(v.price) : p.price);
      }
    } else {
      units = Math.max(0, Number(p.stock ?? 0));
      retail = units * p.price;
    }
    if (units === 0) continue;

    out.units += units;
    out.atRetail += retail;
    if (cost != null) {
      out.atCost += units * cost;
    } else {
      out.unitsMissingCost += units;
      out.productsMissingCost += 1;
    }
  }
  return out;
}
