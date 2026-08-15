// The cashbook: what's actually in the till, as opposed to what Finance says
// was earned.
//
// Profit and cash are different numbers and the owner needs both. Stock is
// bought in bulk from pocket, fees go out in lumps, COD money comes back on
// the courier's schedule, and capital gets put in and taken out — none of
// which is P&L. Finance answers "did we make money"; this page answers "how
// much money is actually in hand right now". Every entry is a real movement
// of cash: money that left, or money that arrived.

export type CashDirection = 'in' | 'out';

export interface CashCategory {
  value: string;
  label: string;
  direction: CashDirection;
  hint: string;
}

// A fixed list rather than free text so the summary can group meaningfully.
// "Other" on each side is the escape hatch.
export const CASH_CATEGORIES: CashCategory[] = [
  // Money out
  { value: 'stock_purchase', label: 'Stock purchase',        direction: 'out', hint: 'Buying products to sell, from a distributor, wholesaler or shop.' },
  { value: 'courier_fees',   label: 'Courier & delivery',    direction: 'out', hint: 'TCS and other courier charges, fuel for deliveries.' },
  { value: 'packaging',      label: 'Packaging & supplies',  direction: 'out', hint: 'Boxes, flyers, tape, printer ink, thank-you cards.' },
  { value: 'fees',           label: 'Fees & subscriptions',  direction: 'out', hint: 'Platform fees, hosting, tools, bank charges, government fees.' },
  { value: 'vendor_payout',  label: 'Vendor payout',         direction: 'out', hint: 'Settling a vendor balance (also shown in Vendors).' },
  { value: 'marketing',      label: 'Marketing & ads',       direction: 'out', hint: 'Ads, gifted boxes, sponsored posts, promo material.' },
  { value: 'owner_draw',     label: 'Owner draw',            direction: 'out', hint: 'Cash taken out of the business for personal use.' },
  { value: 'customer_refund', label: 'Customer refund',      direction: 'out', hint: 'Money returned to a customer on a refunded order.' },
  { value: 'other_out',      label: 'Other (money out)',     direction: 'out', hint: 'Anything paid that fits nowhere above. Say what in the note.' },
  // Money in
  { value: 'cod_remittance', label: 'COD remittance',        direction: 'in',  hint: 'Cash-on-delivery money paid over by the courier.' },
  { value: 'online_payment', label: 'Online payment received', direction: 'in', hint: 'Bank transfer / wallet payments landing in the account.' },
  { value: 'vendor_receipt', label: 'From a vendor',         direction: 'in',  hint: 'A vendor settling what they owed us.' },
  { value: 'capital_in',     label: 'Capital put in',        direction: 'in',  hint: 'Your own money injected to fund purchases. Not income, but it is cash.' },
  { value: 'refund_received',label: 'Refund received',       direction: 'in',  hint: 'A supplier or service refunding us.' },
  { value: 'other_in',       label: 'Other (money in)',      direction: 'in',  hint: 'Anything received that fits nowhere above. Say what in the note.' },
];

export const CASH_CATEGORY_VALUES = CASH_CATEGORIES.map(c => c.value);

export function categoryMeta(value: string): CashCategory {
  return (
    CASH_CATEGORIES.find(c => c.value === value)
    ?? { value, label: value, direction: 'out', hint: '' }
  );
}

export interface CashEntryLike {
  direction: CashDirection;
  amount: number;
}

/** Net cash across a set of entries: everything in minus everything out. */
export function netCash(entries: CashEntryLike[]): number {
  return entries.reduce((n, e) => n + (e.direction === 'in' ? e.amount : -e.amount), 0);
}

/**
 * Running balance per row for a NEWEST-FIRST list (how the page displays it):
 * the first row's balance is the current cash in hand, and each row going
 * down shows what the balance was after that (older) entry.
 */
export function runningBalancesNewestFirst(entries: CashEntryLike[]): number[] {
  const total = netCash(entries);
  const out: number[] = [];
  let balance = total;
  for (const e of entries) {
    out.push(balance);
    balance -= e.direction === 'in' ? e.amount : -e.amount;
  }
  return out;
}

export interface MonthlySummaryRow {
  month: string;   // 'YYYY-MM'
  inflow: number;
  outflow: number;
  net: number;
}

/** Group entries into per-month in/out/net rows, newest month first. */
export function monthlySummary(entries: Array<CashEntryLike & { entry_date: string }>): MonthlySummaryRow[] {
  const byMonth = new Map<string, { inflow: number; outflow: number }>();
  for (const e of entries) {
    const month = e.entry_date.slice(0, 7);
    const row = byMonth.get(month) ?? { inflow: 0, outflow: 0 };
    if (e.direction === 'in') row.inflow += e.amount; else row.outflow += e.amount;
    byMonth.set(month, row);
  }
  return [...byMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, { inflow, outflow }]) => ({ month, inflow, outflow, net: inflow - outflow }));
}
