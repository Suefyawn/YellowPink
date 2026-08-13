import { describe, expect, it } from 'vitest';
import { categoryMeta, monthlySummary, netCash, runningBalancesNewestFirst } from './cash';

// The whole point of the cashbook is that the balance is trustworthy. These
// pin the arithmetic so a display refactor can't quietly break the number the
// owner uses to know what's in the till.

const entries = [
  // Newest first, as the page displays them.
  { direction: 'in' as const,  amount: 5000, entry_date: '2026-08-13' }, // COD remittance
  { direction: 'out' as const, amount: 1200, entry_date: '2026-08-10' }, // courier
  { direction: 'out' as const, amount: 8000, entry_date: '2026-08-02' }, // stock buy
  { direction: 'in' as const,  amount: 10000, entry_date: '2026-07-28' }, // capital in
];

describe('netCash', () => {
  it('is inflow minus outflow', () => {
    expect(netCash(entries)).toBe(5000 - 1200 - 8000 + 10000);
  });

  it('is zero for no entries', () => {
    expect(netCash([])).toBe(0);
  });
});

describe('runningBalancesNewestFirst', () => {
  it('starts at the current balance and walks back through history', () => {
    const balances = runningBalancesNewestFirst(entries);
    expect(balances).toEqual([
      5800,  // after the remittance: current cash in hand
      800,   // after the courier payment
      2000,  // after the stock purchase
      10000, // after the capital injection
    ]);
  });

  it('the oldest row equals that entry alone', () => {
    const balances = runningBalancesNewestFirst(entries);
    expect(balances[balances.length - 1]).toBe(10000);
  });
});

describe('monthlySummary', () => {
  it('groups by month, newest first, with in/out/net', () => {
    expect(monthlySummary(entries)).toEqual([
      { month: '2026-08', inflow: 5000, outflow: 9200, net: -4200 },
      { month: '2026-07', inflow: 10000, outflow: 0, net: 10000 },
    ]);
  });
});

describe('categoryMeta', () => {
  it('resolves known categories', () => {
    expect(categoryMeta('stock_purchase').direction).toBe('out');
    expect(categoryMeta('cod_remittance').direction).toBe('in');
  });

  it('degrades gracefully for an unknown value from old data', () => {
    const m = categoryMeta('legacy_thing');
    expect(m.label).toBe('legacy_thing');
  });
});
